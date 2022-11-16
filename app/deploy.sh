#!/usr/bin/env sh

# https://vitejs.dev/guide/static-deploy.html
# https://docs.github.com/en/authentication/troubleshooting-ssh/error-permission-denied-publickey?platform=linux

# abort on errors
set -e

# build
rm -rf app/dist
yarn build

# navigate into the build output directory
cd app/dist

# place .nojekyll to bypass Jekyll processing
echo > .nojekyll

git init
git checkout -B master
git add -A
git commit -m 'deploy'

# if you are deploying to https://<USERNAME>.github.io/<REPO>
git push -f git@github.com:austinmilt/equilibrate.git master:gh-pages

cd ../
