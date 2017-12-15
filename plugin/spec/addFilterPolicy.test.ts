import child = require('child_process')
import chai = require('chai')
import sinonChai = require('sinon-chai')
import * as sinon from 'sinon'
// import * as handler from '../../integration-test/addFilterPolicy'
import * as handler from '../src/addFilterPolicy'
import AWSMock = require('aws-sdk-mock')
import * as AWS from 'aws-lambda'
import * as sdk from 'aws-sdk'

import * as response from 'cfn-response'
// TODO - temporary
// import * as path from 'path'
// AWSMock.setSDK(path.resolve(__dirname, '../../integration-test/node_modules/aws-sdk'));
// import * as response from '../../integration-test/node_modules/cfn-response'

chai.use(sinonChai)
const expect = chai.expect

describe('addFilterPolicy', () => {

  describe('#on_event()', () => {

    describe('when a valid event is supplied', () => {
      let mockSubscriptionArn = 'arn:aws:sns:us-east-1:123456789012:topic-name:subscription-guid'
      let event = {
        sns_subscription: mockSubscriptionArn,
        filter_policy: {
          "attrib_one": ["foo", "bar"]
        },
      }

      beforeEach(done => {
        let mockCtx: any = {
          done: sinon.spy(),
          logStreamName: 'myLogStream'
        }
        this.mockCallback = (err, data) => {
          if (err) { done.fail() } else { done() }

        }
        // this.snsSpy = sinon.spy()
        // AWSMock.mock("SNS", 'setSubscriptionAttributes', this.snsSpy)
        this.snsSpy = {
          called: false,
          params: undefined,
        }
        var that = this
        AWSMock.mock("SNS", 'setSubscriptionAttributes', (params, callback) => {
          // console.log('mock subscription called')
          // this.snsSpy(params)
          that.snsSpy.called = true
          that.snsSpy.params = params
          callback(null, 'fake_result')
        })


        // let isStubbed = new sdk.SNS()
        // console.log(isStubbed.setSubscriptionAttributes)

        handler.on_event(event, this.mockCtx, this.mockCallback)

      })

      afterEach(() => {
        AWSMock.restore("SNS", 'setSubscriptionAttributes')
      })

      it('should add the filter policy to the SNS subscription', () => {

        let expectedParams = {
          AttributeName: 'FilterPolicy',
          SubscriptionArn: mockSubscriptionArn,
          AttributeValue: "{\"attrib_one\":[\"foo\",\"bar\"]}"
        }
        // expect(this.snsSpy).to.have.been.called
        // expect(this.snsSpy).to.have.been.calledWithMatch(expectedParams)
        expect(this.snsSpy.called).to.be.true
        expect(this.snsSpy.params).to.deep.equal(expectedParams)
      })

    })

    describe('when an invalid event is supplied', () => {

      it('should fail when sns_subscription is undefined', (done) => {
        let malformedEvent: any = {
          sns_subscription: undefined,
          filter_policy: {
            "attrib_one": ["foo", "bar"]
          }
        }

        let mockCallback = (error, response) => {
          expect(error).not.to.be.undefined
          done()
        }
        handler.on_event(malformedEvent, undefined as any, mockCallback)
      })

      it('should fail when filter_policy is undefined', done => {
        let malformedEvent: any = {
          sns_subscription: "foo",
          filter_policy: undefined
        }

        let mockCallback = (error, response) => {
          expect(error).not.to.be.undefined
          done()
        }
        handler.on_event(malformedEvent, undefined as any, mockCallback)
      })
    })
  })

})

describe('#custom_resource_event', () => {
  let mockSubscriptionArn = 'arn:aws:sns:ap-southeast-2:012345678901:testTopic:5f7e20d8-21f5-44c9-b9f6-a74cecb04aff'
  let expectedsetSubscriptionAttributeParams = {
    AttributeName: 'FilterPolicy',
    SubscriptionArn: mockSubscriptionArn,
    AttributeValue: "{\"attrib_one\":[\"foo\",\"bar\"]}"
  }


  beforeEach(() => {
    let mockSnsSubscriptions = require('./test-data/snsListSubscriptions_response_p1.json')

    AWSMock.mock("SNS", 'listSubscriptions', mockSnsSubscriptions)
    // console.log('mocking cfn-response')
    this.responseSpy = sinon.stub(response, 'send')
  })

  afterEach(() => {
    AWSMock.restore("SNS", 'listSubscriptions')
    this.responseSpy.restore()
  })

  describe('SNS API interaction', () => {
    beforeEach(() => {
      this.mockCtx = {
        done: sinon.spy(),
        logStreamName: 'myLogStream'
      }
      this.mockCallback = sinon.spy()
      this.snsSpy = sinon.spy()
      // AWSMock.mock("SNS", 'setSubscriptionAttributes', this.snsSpy)

      this.snsSpy = {
        called: false,
        params: undefined,
      }
      let that = this
      AWSMock.mock("SNS", 'setSubscriptionAttributes', (params, callback) => {
        // console.log('mock subscription called')
        // this.snsSpy(params)
        that.snsSpy.called = true
        that.snsSpy.params = params
        callback(null, 'fake_result')
      })

      // jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000
    })

    afterEach(() => {
      AWSMock.restore("SNS", 'setSubscriptionAttributes')
    })

    it('should pass the ResourceProperties to AWS API when called with CloudFormationCustomResourceCreateEvent', done => {
      let event: any = {
        RequestType: "Create",
        ResponseURL: "http://pre-signed-S3-url-for-response",
        StackId: "arn:aws:cloudformation:us-west-2:EXAMPLE/stack-name/guid",
        RequestId: "unique id for this create request",
        ResourceType: "Custom::TestResource",
        LogicalResourceId: "MyTestResource",
        ServiceToken: 'some token',
        ResourceProperties: {
          ServiceToken: 'some token',
          sns_topicArn: 'arn:aws:sns:ap-southeast-2:012345678901:testTopic',
          functionArn: 'arn:aws:lambda:ap-southeast-2:012345678901:function:test-function',
          filter_policy: "{ \"attrib_one\": [\"foo\", \"bar\"] }"
        }
      }

      // console.log('========')
      handler.custom_resource_event(event, this.mockCtx, (err, data) => {
        // console.log('callback called')
        expect(this.responseSpy).to.have.been.called

        expect(this.snsSpy.called).to.be.true
        expect(this.snsSpy.params).to.deep.equal(expectedsetSubscriptionAttributeParams)

        // expect(this.snsSpy).to.have.been.calledWith(expectedsetSubscriptionAttributeParams)
        done()
      })
      // console.log('========')
    })

    it('should pass the ResourceProperties to AWS API when called with CloudFormationCustomResourceUpdateEvent', done => {
      let event: any = {
        RequestType: "Update",
        ResponseURL: "http://pre-signed-S3-url-for-response",
        StackId: "arn:aws:cloudformation:us-west-2:EXAMPLE/stack-name/guid",
        RequestId: "unique id for this create request",
        ResourceType: "Custom::TestResource",
        LogicalResourceId: "MyTestResource",
        ServiceToken: 'some token',
        ResourceProperties: {
          ServiceToken: 'some token',
          sns_topicArn: 'arn:aws:sns:ap-southeast-2:012345678901:testTopic',
          functionArn: 'arn:aws:lambda:ap-southeast-2:012345678901:function:test-function',
          filter_policy: "{ \"attrib_one\": [\"foo\", \"bar\"] }"
        }
      }

      handler.custom_resource_event(event, this.mockCtx, (err, data) => {
        // expect(this.snsSpy).to.have.been.calledWith(expectedsetSubscriptionAttributeParams)
        expect(this.snsSpy.called).to.be.true
        expect(this.snsSpy.params).to.deep.equal(expectedsetSubscriptionAttributeParams)
        done()
      })
    })

    describe('when called with CloudFormationCustomResourceDeleteEvent', () => {
      let event: any = {
        RequestType: "Delete",
        ResponseURL: "http://pre-signed-S3-url-for-response",
        StackId: "arn:aws:cloudformation:us-west-2:EXAMPLE/stack-name/guid",
        RequestId: "unique id for this create request",
        ResourceType: "Custom::TestResource",
        LogicalResourceId: "MyTestResource",
        PhysicalResourceId: "Some ARN",
        ServiceToken: 'some token',
        ResourceProperties: {
          ServiceToken: 'some token',
          sns_topicArn: 'arn:aws:sns:ap-southeast-2:012345678901:testTopic',
          functionArn: 'arn:aws:lambda:ap-southeast-2:012345678901:function:test-function',
          filter_policy: "{ \"attrib_one\": [\"foo\", \"bar\"] }"
        }
      }

      it('should not invoke AWS API', done => {
        handler.custom_resource_event(event, this.mockCtx, (err, data) => {
          expect(this.snsSpy.called).to.be.false
          // expect(this.snsSpy).not.to.have.been.called
          done()
        })
      })

    })
  })

  it('should fail if the filter_policy is malformed', (done) => {
    let event: any = {
      RequestType: "Create",
      ResponseURL: "http://pre-signed-S3-url-for-response",
      StackId: "arn:aws:cloudformation:us-west-2:EXAMPLE/stack-name/guid",
      RequestId: "unique id for this create request",
      ResourceType: "Custom::TestResource",
      LogicalResourceId: "MyTestResource",
      ServiceToken: 'some token',
      ResourceProperties: {
        ServiceToken: 'some token',
        sns_topicArn: 'arn:aws:sns:ap-southeast-2:012345678901:testTopic',
        functionArn: 'arn:aws:lambda:ap-southeast-2:012345678901:function:test-function',
        filter_policy: "malformed json"
      }
    }

   

    handler.custom_resource_event(event, this.mockCtx, (error, resp) => {
      expect(error).not.to.be.undefined
      
      expect(this.responseSpy).to.have.been.called
      expect(this.responseSpy).to.have.been.calledWith(event, this.mockCtx, response.FAILED, sinon.match.any, "myLogStream")
      done()
    })
  })


  describe('when AWS request succeeds', () => {

    beforeEach(() => {
      this.snsMock = (params, callback) => { callback(null, "some response") }
      AWSMock.mock("SNS", 'setSubscriptionAttributes', this.snsMock)
    })

    afterEach(() => {
      AWSMock.restore("SNS", 'setSubscriptionAttributes')
    })

    let mockSubscriptionArn = 'arn:aws:sns:us-east-1:123456789012:topic-name:subscription-guid'
    let expectedsetSubscriptionAttributeParams = {
      AttributeName: 'FilterPolicy',
      SubscriptionArn: mockSubscriptionArn,
      AttributeValue: "{\"attrib_one\":[\"foo\",\"bar\"]}"
    }

    it('should return a CloudFormationCustomResourceSuccessResponse response', done => {
      let event: any = {
        RequestType: "Create",
        ResponseURL: "http://pre-signed-S3-url-for-response",
        StackId: "arn:aws:cloudformation:us-west-2:EXAMPLE/stack-name/guid",
        RequestId: "unique id for this create request",
        ResourceType: "Custom::TestResource",
        LogicalResourceId: "MyTestResource",
        ServiceToken: 'some token',
        ResourceProperties: {
          ServiceToken: 'some token',
          sns_topicArn: 'arn:aws:sns:ap-southeast-2:012345678901:testTopic',
          functionArn: 'arn:aws:lambda:ap-southeast-2:012345678901:function:test-function',
          filter_policy: "{ \"attrib_one\": [\"foo\", \"bar\"] }"
        }
      }
      handler.custom_resource_event(event, this.mockCtx, (error, result) => {
        expect(error).to.be.null
        
        expect(this.responseSpy).to.have.been.called
        expect(this.responseSpy).to.have.been.calledWith(event, this.mockCtx, response.SUCCESS, sinon.match.any, "myLogStream")
        done()
      })
    })
  })

  describe('when AWS request fails', () => {

    beforeEach(() => {
      this.mockCtx = {
        done: sinon.spy(),
        logStreamName: 'myLogStream'
      }
      this.mockCallback = sinon.spy()
      this.snsMock = (params, callback) => { callback("some error", "some response") }
      AWSMock.mock("SNS", 'setSubscriptionAttributes', this.snsMock)
    })

    afterEach(() => {
      AWSMock.restore("SNS", 'setSubscriptionAttributes')
    })

    let mockSubscriptionArn = 'arn:aws:sns:us-east-1:123456789012:topic-name:subscription-guid'
    let expectedsetSubscriptionAttributeParams = {
      AttributeName: 'FilterPolicy',
      SubscriptionArn: mockSubscriptionArn,
      AttributeValue: "{\"attrib_one\":[\"foo\",\"bar\"]}"
    }

    it('should return a CloudFormationCustomResourceFailedResponse response', done => {
      let event: any = {
        RequestType: "Create",
        ResponseURL: "http://pre-signed-S3-url-for-response",
        StackId: "arn:aws:cloudformation:us-west-2:EXAMPLE/stack-name/guid",
        RequestId: "unique id for this create request",
        ResourceType: "Custom::TestResource",
        LogicalResourceId: "MyTestResource",
        ServiceToken: 'some token',
        ResourceProperties: {
          ServiceToken: 'some token',
          sns_topicArn: 'arn:aws:sns:ap-southeast-2:012345678901:testTopic',
          functionArn: 'arn:aws:lambda:ap-southeast-2:012345678901:function:test-function',
          filter_policy: "{ \"attrib_one\": [\"foo\", \"bar\"] }"
        }
      }
      handler.custom_resource_event(event, this.mockCtx, (error, result) => {
        expect(error).to.equal("some error")
        
        expect(this.responseSpy).to.have.been.called
        expect(this.responseSpy).to.have.been.calledWith(event, this.mockCtx, response.FAILED, sinon.match.any, "myLogStream")
        done()
      })
    })
  })

})

describe('#get_function_subscription()', () => {
  describe('when results are paged', () => {
    beforeEach(() => {
      let mockSnsSubscriptions = require('./test-data/snsListSubscriptions_response_p1.json')
      let mockSnsSubscriptionsP2 = require('./test-data/snsListSubscriptions_response_p2.json')
      let mockSnsSubscriptionsP3 = require('./test-data/snsListSubscriptions_response_p3.json')
      this.snsSubscriptionsSpy = sinon.stub().returns({
        promise: () => {
          return new Promise(resolve => resolve(mockSnsSubscriptions))
        }
      })


      AWSMock.mock("SNS", 'listSubscriptions', (params, callback) => {
        switch (params.NextToken) {
          case 'AAHJm4\/\/eGaqE5Jui+oa0yy8ycQV\/f8Cf8GYbWxFsGRUWw==': callback(null, mockSnsSubscriptionsP2)
          case 'page3': callback(null, mockSnsSubscriptionsP3)
          default: callback(null, mockSnsSubscriptions)
        }
      })
    })

    afterEach(() => {
      AWSMock.restore("SNS", 'listSubscriptions')
    })

    it('should return the promise of a string', () => {
      handler.get_function_subscription('foo', 'bar').then(result => {
        expect(result).to.be.an.instanceof(String)
      })
    })

    describe('when the target subscription is in the first page', () => {
      let topicArn = 'arn:aws:sns:ap-southeast-2:012345678901:testTopic'
      let functionArn = 'arn:aws:lambda:ap-southeast-2:012345678901:function:test-function'

      it('should return the sns subscription', (done) => {
        handler.get_function_subscription(topicArn, functionArn).then(result => {
          expect(result).to.equal('arn:aws:sns:ap-southeast-2:012345678901:testTopic:5f7e20d8-21f5-44c9-b9f6-a74cecb04aff')
        }).then(done).catch(done.fail)
      })

    })

    describe('when the target subscription is in the second page', () => {
      let topicArn = 'arn:aws:sns:ap-southeast-2:012345678901:p2_topic'
      let functionArn = 'arn:aws:lambda:ap-southeast-2:012345678901:function:p2_function'

      it('should return the sns subscription', (done) => {
        handler.get_function_subscription(topicArn, functionArn).then(result => {
          expect(result).to.equal('arn:aws:sns:ap-southeast-2:012345678901:p2_topic:365c86bd-f350-498a-9987-deba50e3685f')
        }).then(done).catch(done.fail)
      })

    })

    describe('when the target subscription is after the second page', () => {
      let topicArn = 'arn:aws:sns:ap-southeast-2:012345678901:p3_topic'
      let functionArn = 'arn:aws:lambda:ap-southeast-2:012345678901:function:p3_function'

      it('should return the sns subscription', (done) => {
        handler.get_function_subscription(topicArn, functionArn).then(result => {
          expect(result).to.equal('arn:aws:sns:ap-southeast-2:012345678901:p3_topic:365c86bd-f350-498a-9987-deba50e3685f')
        }).then(done).catch(done.fail)
      })

    })

    describe('when the target subscription is not in the results', () => {
      it('should throw Error', done => {
        let topicArn = 'not_found'
        let functionArn = 'arn:aws:lambda:ap-southeast-2:012345678901:function:p3_function'

        handler.get_function_subscription(topicArn, functionArn).then(result => {
          done.fail('expected error to be thrown but was: ' + result)
        }).catch(done)
      })
    })

  })
  describe('when no subscriptions and no nextToken', () => {
    beforeEach(() => {
      let mockSnsSubscriptionsError = require('./test-data/snsListSubscriptions_response_error.json')
      AWSMock.mock("SNS", 'listSubscriptions', (params, callback) => {
        callback(null, mockSnsSubscriptionsError)
      })
    })

    afterEach(() => {
      AWSMock.restore("SNS", 'listSubscriptions')
    })

    it('should throw Error', done => {
      let topicArn = 'not_found'
      let functionArn = 'not_found'
      handler.get_function_subscription(topicArn, functionArn).then(result => {
        done.fail('expected error to be thrown but was: ' + result)
      }).catch(done)
    })
  })
})
