#! /usr/local/bin/node
const AWS=require('aws-sdk')
const fs=require('fs')
const path=require('path')

cf = new AWS.CloudFormation({
    region: 'ap-southeast-2',
})

let templateBody=fs.readFileSync(path.resolve(__dirname, 'template.yml'))
console.log(`deploying ${templateBody}`)
const params={
    StackName: 'sns-filter-it-setup',
    TemplateBody: templateBody.toString()
}

cf.createStack(params).promise().then(console.log)