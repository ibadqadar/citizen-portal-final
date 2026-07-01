const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const k8sDir = path.join(__dirname, 'k8s');
let hasErrors = false;

function getAllYamlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllYamlFiles(filePath, fileList);
    } else if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function validateManifest(doc, filePath) {
  const relativePath = path.relative(__dirname, filePath);
  
  if (!doc) {
    // Empty document
    return;
  }

  // General checks
  if (!doc.apiVersion) {
    console.error(`[ERROR] ${relativePath}: Missing 'apiVersion'`);
    hasErrors = true;
    return;
  }
  if (!doc.kind) {
    console.error(`[ERROR] ${relativePath}: Missing 'kind'`);
    hasErrors = true;
    return;
  }
  if (!doc.metadata || !doc.metadata.name) {
    console.error(`[ERROR] ${relativePath}: Missing 'metadata.name'`);
    hasErrors = true;
    return;
  }

  const kind = doc.kind;
  const name = doc.metadata.name;

  // Kind-specific structural checks
  if (kind === 'Deployment' || kind === 'StatefulSet' || kind === 'DaemonSet' || kind === 'Job' || kind === 'CronJob') {
    let podSpec;
    if (kind === 'CronJob') {
      podSpec = doc.spec?.jobTemplate?.spec?.template?.spec;
    } else {
      podSpec = doc.spec?.template?.spec;
    }

    if (kind !== 'Job' && kind !== 'CronJob') {
      const matchLabels = doc.spec?.selector?.matchLabels;
      const templateLabels = doc.spec?.template?.metadata?.labels;

      if (!matchLabels) {
        console.error(`[ERROR] ${relativePath} (${kind}/${name}): Missing 'spec.selector.matchLabels'`);
        hasErrors = true;
      }
      if (!templateLabels) {
        console.error(`[ERROR] ${relativePath} (${kind}/${name}): Missing 'spec.template.metadata.labels'`);
        hasErrors = true;
      }

      // Check if matchLabels are a subset of templateLabels
      if (matchLabels && templateLabels) {
        for (const [key, val] of Object.entries(matchLabels)) {
          if (templateLabels[key] !== val) {
            console.error(`[ERROR] ${relativePath} (${kind}/${name}): selector label '${key}: ${val}' does not match pod template label`);
            hasErrors = true;
          }
        }
      }
    }

    if (!podSpec) {
      console.error(`[ERROR] ${relativePath} (${kind}/${name}): Missing pod specification`);
      hasErrors = true;
    } else {
      if (!podSpec.containers || !Array.isArray(podSpec.containers) || podSpec.containers.length === 0) {
        console.error(`[ERROR] ${relativePath} (${kind}/${name}): Pod spec must contain at least one container`);
        hasErrors = true;
      } else {
        podSpec.containers.forEach((container, idx) => {
          if (!container.name) {
            console.error(`[ERROR] ${relativePath} (${kind}/${name}): Container at index ${idx} is missing a name`);
            hasErrors = true;
          }
          if (!container.image) {
            console.error(`[ERROR] ${relativePath} (${kind}/${name}): Container '${container.name || idx}' is missing an image`);
            hasErrors = true;
          }
        });
      }
    }
  }

  if (kind === 'Service') {
    const ports = doc.spec?.ports;
    if (!ports || !Array.isArray(ports) || ports.length === 0) {
      console.error(`[ERROR] ${relativePath} (Service/${name}): Service must define at least one port under 'spec.ports'`);
      hasErrors = true;
    } else {
      ports.forEach((port, idx) => {
        if (!port.port) {
          console.error(`[ERROR] ${relativePath} (Service/${name}): Port at index ${idx} is missing 'port' value`);
          hasErrors = true;
        }
      });
    }
  }

  if (kind === 'Ingress') {
    const rules = doc.spec?.rules;
    if (!rules && !doc.spec?.defaultBackend) {
      console.error(`[ERROR] ${relativePath} (Ingress/${name}): Ingress must specify either 'rules' or a 'defaultBackend'`);
      hasErrors = true;
    }
  }
}

try {
  console.log(`Scanning Kubernetes manifests directory: ${k8sDir}\n`);
  const yamlFiles = getAllYamlFiles(k8sDir);
  console.log(`Found ${yamlFiles.length} Kubernetes YAML manifest files.\n`);

  yamlFiles.forEach(filePath => {
    const relativePath = path.relative(__dirname, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    try {
      // Parse multi-document YAMLs
      const docs = yaml.loadAll(content);
      docs.forEach(doc => {
        validateManifest(doc, filePath);
      });
      console.log(`[PASS] ${relativePath} - Parsed and validated successfully`);
    } catch (e) {
      console.error(`[ERROR] ${relativePath}: YAML syntax error - ${e.message}`);
      hasErrors = true;
    }
  });

  console.log('\n----------------------------------------');
  if (hasErrors) {
    console.error('Kubernetes manifest validation FAILED.');
    process.exit(1);
  } else {
    console.log('Kubernetes manifest validation PASSED successfully.');
    process.exit(0);
  }
} catch (err) {
  console.error('Fatal error during validation:', err.message);
  process.exit(1);
}
