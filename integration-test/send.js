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

const without_attribute = (event, context, callback) => {
  const params = {
    Message: 'should be filtered',
    Subject: "Filtered message",
    TopicArn: process.env['TOPIC_ARN']
  }

  publish_sns(params,callback)
}

module.exports = {
  without_attribute: without_attribute,
  with_attribute: with_attribute,
  publish_sns: publish_sns
}
