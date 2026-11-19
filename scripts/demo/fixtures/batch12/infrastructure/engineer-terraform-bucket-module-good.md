Mode: Engineer answer
## Engineer answer
**Evidence read:** No evidence given; this is reasoning. The ask is a reusable Terraform module for one private AWS bucket that the analytics team's export job writes to.
**Options:**
1. A small module of our own around `aws_s3_bucket`, private and encrypted by default, with one writer role passed in. Trade-off: we maintain it, but every default is visible in review.
2. The community bucket module pinned to one version. Trade-off: less code, many more inputs, and its defaults move only when we change the pin.
**Recommendation:** option 1. A person opens the pull request, reads the plan (only `+` lines: R2, four new objects), and the workspace owner applies the saved plan:

```hcl
variable "name" {
  type        = string
  description = "Bucket name, lower case"
}
variable "writer_role_arn" {
  type        = string
  description = "The one role allowed to write exports"
}

resource "aws_s3_bucket" "this" {
  bucket = var.name
  lifecycle { prevent_destroy = true }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "aws:kms" }
  }
}

data "aws_iam_policy_document" "writer" {
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.this.arn}/exports/*"]
    principals {
      type        = "AWS"
      identifiers = [var.writer_role_arn]
    }
  }
}

resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.this.id
  policy = data.aws_iam_policy_document.writer.json
}

output "bucket_arn" { value = aws_s3_bucket.this.arn }
```

**Blast radius:** one new bucket and its policy; nothing existing changes. Rollback before data lands is removing the module call (lift `prevent_destroy` first). Stop if the plan shows any `~`, `-/+` or `-` line.
**Verify:** the plan shows four creates; after the apply the export job writes one object under `exports/`, and a request with no credentials is refused.
**Ask next:** who owns the data in this bucket, for the owner tag and for approving readers later?

## Human-run and read-back
- **Apply the bucket module's saved plan.** Runs it: the workspace owner. Confirms first: the plan shows four creates and no change to anything existing. Verify: the export job writes one object under exports/ and a request with no credentials is refused.

```aegis-desk
Gate: none
```
