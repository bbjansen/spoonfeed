# Terraform

Modular Terraform setup for deploying a NestJS application to AWS using ECS Fargate.

## Architecture

The root configuration is provider-agnostic and delegates to provider-specific modules:

```
terraform/
├── main.tf.ejs          # Root config with S3 backend (templated)
├── variables.tf         # Root-level variables
├── outputs.tf           # Root-level outputs
└── modules/
    └── app/             # AWS ECS Fargate module
        ├── main.tf      # ECS cluster, task definition, service
        ├── variables.tf # Module variables
        ├── outputs.tf   # Module outputs
        ├── iam.tf       # IAM roles for ECS execution and task
        ├── alb.tf       # Application Load Balancer
        └── security.tf  # Security groups
```

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- AWS credentials configured (`aws configure` or environment variables)
- An S3 bucket for Terraform state storage
- A VPC with private subnets

## Usage

### Initialize

```bash
terraform init \
  -backend-config="bucket=my-terraform-state" \
  -backend-config="key=my-app/terraform.tfstate" \
  -backend-config="region=eu-west-1"
```

### Plan

```bash
terraform plan -var="environment=dev"
```

### Apply

```bash
terraform apply -var="environment=dev"
```

### Destroy

```bash
terraform destroy -var="environment=dev"
```

## Variables

| Variable      | Type   | Default     | Description                                       |
| ------------- | ------ | ----------- | ------------------------------------------------- |
| `environment` | string | `dev`       | Deployment environment (dev, staging, production) |
| `region`      | string | `eu-west-1` | AWS region                                        |

### Module Variables (`modules/app`)

| Variable             | Type         | Default                 | Description                |
| -------------------- | ------------ | ----------------------- | -------------------------- |
| `app_name`           | string       | -                       | Application name           |
| `environment`        | string       | -                       | Deployment environment     |
| `region`             | string       | `eu-west-1`             | AWS region                 |
| `container_image`    | string       | `REGISTRY/IMAGE:latest` | Docker image URI           |
| `cpu`                | number       | `256`                   | Fargate task CPU units     |
| `memory`             | number       | `512`                   | Fargate task memory (MB)   |
| `desired_count`      | number       | `2`                     | Number of running tasks    |
| `private_subnet_ids` | list(string) | `[]`                    | Subnet IDs for ECS tasks   |
| `vpc_id`             | string       | `""`                    | VPC ID for security groups |

## Modules

### `modules/app`

Deploys the NestJS application on AWS ECS Fargate with:

- **ECS Cluster** with Container Insights enabled
- **Fargate Task Definition** with health checks and CloudWatch logging
- **ECS Service** behind an Application Load Balancer
- **ALB** with HTTPS listener and health-check-based target group
- **IAM Roles** for ECS task execution and runtime permissions
- **Security Groups** restricting traffic between ALB and containers

## References

- [Terraform Documentation](https://developer.hashicorp.com/terraform/docs)
- [AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [ECS Fargate](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ecs_service)
- [Application Load Balancer](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lb)
