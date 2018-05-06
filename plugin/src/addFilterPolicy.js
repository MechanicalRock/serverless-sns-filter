const response = require('cfn-response');
var AWS = require('aws-sdk');

const on_event = (event, context, callback) => {

  let subscriptionArn = event.sns_subscription
  console.log(`Setting Filter policy '${JSON.stringify(event.filter_policy)}' for subscription '${subscriptionArn}'`)
  const sns = new AWS.SNS()
  sns.setSubscriptionAttributes({
    AttributeName: 'FilterPolicy',
    SubscriptionArn: subscriptionArn,
    AttributeValue: JSON.stringify(event.filter_policy)
  }).promise().then(result => { callback(null, result) }).catch(err => { callback(err) })
}

const do_get_function_subscription = (sns, sns_topic, function_arn, nextPage) => {
  return sns.listSubscriptions({ NextToken: nextPage }).promise().then(response => {
    nextPage = response.NextToken
    if (response.Subscriptions) {
      var matchingSubscription = response.Subscriptions.filter(subscription => (subscription.TopicArn === sns_topic) && (subscription.Endpoint === function_arn))[0]
      if (matchingSubscription) {
        return matchingSubscription.SubscriptionArn
      }
    }

    if (nextPage) {
      return do_get_function_subscription(sns, sns_topic, function_arn, nextPage)
    } else {
      throw new Error(`no matching subscription for topic ${sns_topic} and function ${function_arn}`)
    }
  })
}

function get_function_subscription(sns_topic, function_arn) {
  // TODO - refactor to construct SNS once
  const sns = new AWS.SNS()
  return new Promise((accept, reject) => {

    do_get_function_subscription(sns, sns_topic, function_arn).then(accept).catch(reject)

  })
}

function custom_resource_event(event, context, callback) {
  let physicalResouceId = context.logStreamName;

  // Delete events don't need to be supported - they shall be deleted when the subscription is deleted.
  // AWS currently does not support removing filters :(
  if (event.RequestType === 'Create' || event.RequestType === 'Update') {
    let filterRequestEvent;
    get_function_subscription(event.ResourceProperties.sns_topicArn, event.ResourceProperties.functionArn).then(subscription_arn => {
      filterRequestEvent = {
        sns_subscription: subscription_arn,
        filter_policy: JSON.parse(event.ResourceProperties.filter_policy)
      }

      on_event(filterRequestEvent, context, (error, result) => {
        if (error) {
          response.send(event, context, response.FAILED, { error: error }, physicalResouceId)

          callback(error)
        } else {
          response.send(event, context, response.SUCCESS, { result: result }, physicalResouceId)
          callback(null, "ok")
        }
      })

    }).catch(err => {
      response.send(event, context, response.FAILED, { error: err }, physicalResouceId)
      callback(err)
    })
  } else {
    response.send(event, context, response.SUCCESS, { result: 'delete not supported - To remove a SubscriptionFilter, delete the Topic Subscription' }, physicalResouceId)
    callback(null, "ok")
  }

}

module.exports = {
  custom_resource_event: custom_resource_event,
  get_function_subscription: get_function_subscription,
  on_event: on_event
}
