# serverless-sns-filter

[Documentation is here](plugin/)

# Integration Testing

To run the integration test:

```
aws cloudformation create-stack --region ap-southeast-2 --stack-name sns-filter-it-setup --template-body file://integration-test/template.yml
cd plugin
yarn run setup:dev
cd ../integration-test
yarn run setup:dev
yarn run deploy:dev
cd ../plugin
yarn run test:it
```