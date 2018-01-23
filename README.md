# serverless-sns-filter

[Documentation is here](plugin/)

# Integration Testing

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