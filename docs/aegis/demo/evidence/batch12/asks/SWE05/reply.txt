No, switching the pipeline to npm install isn't the right fix, though I understand why it's tempting. Your error shows that the last merge asked for dotenv version 17 but left the old version recorded in the lock file, so npm ci refuses to install.

Your idea would make the build pass by having CI quietly rewrite that lock file on every run. Builds would stop being repeatable, and nobody would review what gets installed. I haven't confirmed which merge caused it, but the error text points to the lock file not being updated.

There's nothing you need to do meanwhile. Next, a developer regenerates the lock file on a branch and opens a pull request. Once that PR's CI run passes and it's merged, main builds again.
