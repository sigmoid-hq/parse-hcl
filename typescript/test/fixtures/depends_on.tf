resource "aws_s3_bucket" "base" {
  bucket = "base-bucket"
}

resource "aws_s3_bucket" "dependent" {
  bucket      = "dependent-bucket"
  depends_on  = [aws_s3_bucket.base]
}
