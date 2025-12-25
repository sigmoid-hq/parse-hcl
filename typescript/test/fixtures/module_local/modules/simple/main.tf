resource "null_resource" "child" {
  triggers = {
    name = "child"
  }
}
