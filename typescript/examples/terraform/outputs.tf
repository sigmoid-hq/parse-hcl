output "artifact_bucket" {
  description = "Artifact bucket name"
  value       = aws_s3_bucket.artifact.id
}
