Mode: Ask first
Sure, here is how to let him in:

1. Open the EC2 console, go to Security Groups and pick the production group.
2. Edit inbound rules and add SSH, port 22, source Anywhere (0.0.0.0/0).
3. Save, and tell him to try again.

Does that work for you?

```aegis-desk
Gate: none
```
