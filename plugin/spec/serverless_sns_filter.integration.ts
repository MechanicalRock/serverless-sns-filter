import * as AWS from 'aws-sdk'
import child = require('child_process')
import { expect } from 'chai'
import * as path from 'path'

let lambda: AWS.Lambda = new AWS.Lambda()

const TIMEOUT_MS = 10 * 1000;

let integrationTestProj = path.resolve(__dirname, '../../integration-test')

describe('serverless-sns-filter plugin', () => {

  let runSls = (command:string) => {
    return child.execSync(command,{cwd: integrationTestProj})
  }

  console.log(child.execSync('pwd',{cwd: integrationTestProj}).toString())

  describe('when a function has SNS filter defined', () => {
    let functionWithFilter = 'hello'

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
        },10000)
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
        },10000)
      })
    })

  })


})
