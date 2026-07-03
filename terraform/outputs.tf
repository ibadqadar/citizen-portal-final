output "master_private_ips" {
  description = "Private IP addresses of K3s control plane nodes"
  value       = aws_instance.k3s_master[*].private_ip
}

output "worker_private_ips" {
  description = "Private IP addresses of K3s worker nodes"
  value       = aws_instance.k3s_worker[*].private_ip
}

output "load_balancer_dns" {
  description = "DNS name of the Network Load Balancer"
  value       = aws_lb.k3s_nlb.dns_name
}

output "backup_bucket_name" {
  description = "S3 bucket for application backups and storage"
  value       = aws_s3_bucket.backups.id
}
