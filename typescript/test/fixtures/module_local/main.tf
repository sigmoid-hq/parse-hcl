module "simple" {
  source = "./modules/simple"
}

resource "null_resource" "module_root" {
  triggers = {
    name = "root"
  }
}
