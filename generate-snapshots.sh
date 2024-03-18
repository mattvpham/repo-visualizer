#!/bin/bash
set -euo pipefail

currentdir=$(pwd)
targetdir=$1

cd $targetdir

# Get all commit hashes with [ETD-*] in the commit message
commits=$(git log --pretty=format:'%H' --grep='\[ETD-.*\]' --reverse)

counter=1
# Loop over each commit
for commit in $commits
do
    # Checkout the commit
    git checkout $commit

    # Get the commit message
    message=$(git log -1 --pretty=format:'%s' $commit)

    # Print the commit message and counter
    echo "Commit $counter: $message"

    # Run your command here
    cd $currentdir
    node index.js $targetdir/apps/kairos diagram$counter.svg
    cd $targetdir

    # Increment counter
    ((counter++))
done

# Checkout the original branch after running the commands
git checkout main