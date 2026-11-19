Mode: Fix card
## Fix
**What's wrong:** the front-desk label printer prints blank labels since its driver update.
**Do this:**
1. On the front-desk PC, open Printers & scanners and read the driver version.
2. Print the printer's own test label from its button.
3. If it prints, roll back the driver in Device Manager → Roll Back Driver.
**Done when:** a label printed from the PC shows its text.
**Stop if:** the printer's own test label is blank too.
**Tell the user now:** IT is looking at the label printer. Please write labels by hand meanwhile.
**Tell the user when done:** The label printer prints normally again.

## Details
Step 1 reads the driver version the update installed, to tell a driver fault from a printer fault. Step 2 prints from the printer alone: a good label there puts the fault in the PC's driver. Step 3 can be undone by installing the newer driver again.

```aegis-desk
Gate: none
```
