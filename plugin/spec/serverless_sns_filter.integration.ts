import AWS= require('aws-sdk')
import child = require('child_process')
import { expect } from 'chai'
import * as path from 'path'
import * as addFilterPolicy from '../src/addFilterPolicy'

let lambda: AWS.Lambda = new AWS.Lambda()

const TIMEOUT_MS = 10 * 1000;

let integrationTestProj = path.resolve(__dirname, '../../integration-test')

describe('serverless-sns-filter plugin', () => {

  let runSls = (command: string) => {
    return child.execSync(command, { cwd: integrationTestProj })
  }

  console.log(child.execSync('pwd', { cwd: integrationTestProj }).toString())

  describe('when a function has SNS filter defined', () => {
    let functionWithFilter = 'hello'
    let functionWithFilterUsingArn = 'helloPreexisting'

    describe('when SNS message is published that matches the filter', () => {
      beforeAll(done => {
        let publishSnsWithAttribsFunction = 'sendMessage'
        let stdOut: any = runSls(`sls invoke -f ${publishSnsWithAttribsFunction}`)
        this.messageId = JSON.parse(stdOut).MessageId

        console.log(`sent message: ${this.messageId}`)

        jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

        done()
      })

      it('should receive the message', done => {
        expect(this.messageId).not.to.be.undefined

        // it can take a period of time for the logs to come through
        setTimeout(() => {
          expect(runSls(`sls logs -f ${functionWithFilter}`).toString()).to.include(this.messageId)
          done()
        }, 10000)
      })

    })

    describe('when SNS message is published that does not match the filter', () => {
      beforeAll(done => {
        let publishNonMatchingSnsFunction = 'sendFilteredMessage'
        let stdOut: any = runSls(`sls invoke -f ${publishNonMatchingSnsFunction}`)
        this.messageId = JSON.parse(stdOut).MessageId

        console.log(`sent message: ${this.messageId}`)
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
        done()
      })

      it('should not receive the message', done => {
        expect(this.messageId).not.to.be.undefined

        // it can take a period of time for the logs to come through
        setTimeout(() => {
          expect(runSls(`sls logs -f ${functionWithFilter}`).toString()).not.to.include(this.messageId)
          done()
        }, 10000)
      })
    })

    it('should be applied to the subscription', done => {
      // TODO - cleanup

      let filterPolicy = require('../src/addFilterPolicy')

      let service='sls-plugin-it'
      let stage='dev'
      let preExistingTopic = 'prexisting-topic'
      let generatedTopic = `${service}-greeter-${stage}`
      
      AWS.config = new AWS.Config({ region: 'ap-southeast-2' })
      
      let sns = new AWS.SNS()


      new AWS.Lambda().getFunctionConfiguration({ FunctionName: 'sls-plugin-it-dev-helloPreexisting' }).promise().then(result => {
        let functionArn = result.FunctionArn
        
        return sns.listTopics().promise().then(topics => {
          if(topics && topics.Topics){
            let matchingTopic = (topic) => {return (topic.TopicArn && topic.TopicArn.includes(preExistingTopic))}
            let topicForFunction = topics.Topics.find(matchingTopic)
            if(topicForFunction){

              console.log(`functionArn: ${functionArn}, topicArn: ${topicForFunction.TopicArn}`)
              return addFilterPolicy.get_function_subscription(topicForFunction.TopicArn, functionArn)

            }

          }

          throw new Error('Subscription not found')

        })
      }).then((subscriptionArn:any) => {
        console.log('found subscription: ' + subscriptionArn)
        return sns.getSubscriptionAttributes({SubscriptionArn: subscriptionArn}).promise()
      }).then((subscriptionAttribs:AWS.SNS.GetSubscriptionAttributesResponse) => {
        let attribs: any = subscriptionAttribs.Attributes
        expect(attribs).contains.any.keys(['FilterPolicy'])
        expect(attribs.FilterPolicy).to.equal("{\"attrib_one\":[\"foo\",\"bar\"]}")
        done()
      }).then(done).catch(done.fail)

    })

  })


})
