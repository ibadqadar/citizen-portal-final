# Terraform baseline for DESC Citizen Portal 5-Node k3s Cluster

provider "local" {
  # Using local provider as a placeholder for your VM environments
}

variable "node_count_control_plane" {
  default = 3
  description = "Number of control-plane nodes for etcd quorum"
}

variable "node_count_worker" {
  default = 2
  description = "Number of worker nodes for hosting applications"
}

output "cluster_summary" {
  value = "Deploying a highly-available cloud-native platform with ${var.node_count_control_plane} control-plane nodes and ${var.node_count_worker} worker nodes."
}
