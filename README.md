# serverless-sns-filter

[Documentation is here](plugin/)

# Contributing


* The person who found a bug should fix the bug by themself.
* If you find a bug and cannot fix it by yourself, send a pull request and attach test code to reproduce the bug, please.
* The person who want a new feature should implement it by themself.
* For above reasons, we accept pull requests only and disable issues.
* If you're not sure how to fix an issue, please create a pull request demonstrating a [minimal viable complete example](https://stackoverflow.com/help/mcve) as a failing test.
* If you'd like to discuss about a new feature before implement it, make an empty commit and send a WIP pull request. But It is better that the WIP PR has some code than an empty commit.

1. Fork it
2. Create your feature branch (git checkout -b my-new-feature)
3. Commit your changes (git commit -am 'Add some feature')
4. Push to the branch (git push origin my-new-feature)
5. Create new Pull Request

## Development

Development should be undertaken using the included Docker container to ensure a consistent development environment:

`docker-compose run --rm serverless`

## Publishing

```
cd plugin
yarn install
yarn version
yarn run build
yarn run test
npm login
npm publish
git push
git push --tags
```

## Integration Testing

To run the integration test:

```
node integration-test/sns-filter-it-setup.js
cd plugin
yarn run setup:dev
cd ../integration-test
yarn run setup:dev
yarn run deploy:dev
cd ../plugin
yarn run test:it
```