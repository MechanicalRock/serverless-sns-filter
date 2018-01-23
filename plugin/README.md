# serverless-sns-filter

A serverless plugin to add [SNS Subscription](http://docs.aws.amazon.com/sns/latest/dg/message-filtering.html) filters to lambda events

* [Installation](#installation)
* [Configuration](#configuration)
* [Usage](#usage)
* [Limitations](#limitations)
* [Contributing](#contributing)

For an example of a working application, see the [integration-test](../integration-test/)

This plugin adds the following resources to your Serverless Cloudformation stack:
 - A lambda function (invoked using CloudFormation Custom Resources) that adds an SNS Subscription Filter to a SNS Subscription
 - An IAM Role, with a policy, to allow the above Lambda to create the SNS subscription filters including the following:
 ```
 - Effect: Allow
            Action:
            - SNS:ListSubscriptions
            Resource:
            - Fn::Sub: arn:aws:sns:${AWS::Region}:${AWS::AccountId}:*
          - Effect: Allow
            Action:
            - SNS:setSubscriptionAttributes
            Resource:
              Fn::Sub: arn:aws:sns:${AWS::Region}:${AWS::AccountId}:*
```

# Installation

Install the plugin:

`npm install serverless-sns-filter`

Add the plugin to your `serverless.yml`
```
plugins:
  - serverless-sns-filter
```

# Configuration

Add a filter policy to your function under the events section:

```
functions:
  hello:
    handler: handler.hello
    events:
      - sns: ${self:custom.greeterTopic}
        # filter policy to accept messages with attrib_one values including "foo" OR "bar"
        filter:
          attrib_one:
            - foo
            - bar
```

# Usage

SNS Subscription filters require SNS notifications to include `MessageAttributes` that the filters are matched against.

Example, NodeJS lambda that shall post a message that shall be received by the hello function above:

serverless.yml:

```
  sendMessage:
    handler: send.with_attribute
    environment:
      TOPIC_ARN: "${{self:custom.greeterTopicArn}}"
```

`send.js`:
```
const AWS = require('aws-sdk')
let sns = new AWS.SNS()

const publish_sns = (params, callback) => {
  sns.publish(params).promise().then(done => {
    console.log(JSON.stringify(done))
    callback(null,done)
  }).catch(error => {
    console.log(JSON.stringify(error))
    callback(error,"send failed")
  })
}

const with_attribute = (event, context, callback) => {
  const topicArn = process.env['TOPIC_ARN']
  console.log(`publishing to topic: ${topicArn}`)
  const params = {
    Message: 'should be received',
    MessageAttributes: {
      'attrib_one': {
        DataType: 'String',
        StringValue: 'foo'
      }
    },
    Subject: "Successful message",
    TopicArn: topicArn
  }

  publish_sns(params,callback)

}

module.exports = {
  with_attribute: with_attribute
}
```

# Limitations

* SNS Subscription Filters cannot be removed at the present time.  If you need to remove a filter, then remove the SNS subscription and re-create it without the filter definition.

* The plugin currently only supports a single SNS filter per function.
