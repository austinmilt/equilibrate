#!/usr/bin/env sh

# https://vitejs.dev/guide/static-deploy.html

# abort on errors
set -e

# build
yarn build

# navigate into the build output directory
cd app/dist

# place .nojekyll to bypass Jekyll processing
echo > .nojekyll

git init
git checkout -B main
git add -A
git commit -m 'deploy'

# if you are deploying to https://<USERNAME>.github.io/<REPO>
git push -f git@github.com:austinmilt/equilibrate.git main:gh-pages

cd ../
