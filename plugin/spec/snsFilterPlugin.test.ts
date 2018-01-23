import child = require('child_process')
import chai = require('chai')
import sinonChai = require('sinon-chai')
import * as sinon from 'sinon'
import AWS = require('aws-sdk-mock')
// import * as AWS from 'aws-sdk' 
import * as Serverless from 'serverless'
import * as AwsProvider from 'serverless/lib/plugins/aws/provider/awsProvider'
import { SnsFilterPlugin } from '../src/snsFilterPlugin';
import * as path from 'path';
import * as _ from 'lodash';

chai.use(sinonChai)
const expect = chai.expect

describe('serverless-sns-filter/snsFilterPlugin.ts', () => {

    let sampleCompiledCloudformationTemplate = {
        Resources:
            {
                HelloLambdaFunction: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        FunctionName: 'serverless-sns-filter-integration-test-dev-hello',
                    }
                },
                SendMessageLambdaFunction: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        FunctionName: 'serverless-sns-filter-integration-test-dev-sendMessage',
                    }
                },
                SNSTopicServerlesssnsfilterintegrationtestgreeterdev:
                    {
                        Type: 'AWS::SNS::Topic',
                        Properties:
                            {
                                TopicName: 'serverless-sns-filter-integration-test-greeter-dev',
                                DisplayName: '',
                                Subscription: [{
                                    Endpoint: {
                                        'Fn::GetAtt': [
                                            "HelloLambdaFunction",
                                            "Arn"
                                        ]
                                    }, Protocol: 'lambda'
                                }]
                            }
                    },
                HelloPreexistingLambdaFunction: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        FunctionName: 'sls-plugin-it-dev-helloPreexisting',
                    },
                },
                HelloPreexistingSnsSubscriptionPrexistingtopic: {
                    Type: 'AWS::SNS::Subscription',
                    Properties: {
                        TopicArn: {
                            'Fn::Join': [
                                '',
                                [
                                    'arn:aws:sns:ap-southeast-2:',
                                    {
                                        Ref: 'AWS::AccountId'
                                    },
                                    ':prexisting-topic'
                                ]
                            ]
                        },
                        Protocol: 'lambda',
                        Endpoint: {
                            'Fn::GetAtt': [
                                'HelloPreexistingLambdaFunction',
                                'Arn'
                            ]
                        }
                    }
                }
            },
        Outputs: { ServerlessDeploymentBucketName: { Value: { Ref: 'ServerlessDeploymentBucket' } } }
    };

    let serverless;

    let sandbox;
    let awsProvider;

    let debug = false;
    // let debug = true;

    // let instance;


    beforeEach(() => {
        sandbox = sinon.sandbox.create();
        serverless = new Serverless();
        awsProvider = new AwsProvider(serverless, {});
        awsProvider.sdk = AWS;
        serverless.init();
        serverless.setProvider('aws', awsProvider);
        serverless.cli.log = function () {
            if (debug) {
                console.log.apply(this, arguments);
            }
        }

        serverless.service.provider.compiledCloudFormationTemplate = sampleCompiledCloudformationTemplate
    });


    describe('#constructor()', () => {
        let instance;

        beforeEach(() => {
            instance = new SnsFilterPlugin(serverless, {});

        })

        it('should have a dependency on serverless', () => {
            expect(instance.serverless).to.equal(serverless)
        })

        it('should initialise hook "after:aws:package:finalize:mergeCustomProviderResources"', () => {
            let hook = instance.hooks['after:aws:package:finalize:mergeCustomProviderResources'];
            expect(hook).not.to.be.undefined
            expect(hook).to.equal(instance.createDeploymentArtifacts)
        })

    });

    describe('#createDeploymentArtifacts()', () => {
        beforeEach(async done => {
            serverless.service.functions = {
                hello:
                    {
                        handler: 'handler.hello',
                        events:
                            [{
                                sns: 'serverless-sns-filter-integration-test-greeter-dev',
                                filter: { attrib_one: ['foo', 'bar'] }
                            }],
                        name: 'serverless-sns-filter-integration-test-dev-hello',
                    }
            }
            serverless.service.provider.compiledCloudFormationTemplate = sampleCompiledCloudformationTemplate

            let instance = new SnsFilterPlugin(serverless, {});

            await instance.createDeploymentArtifacts();

            this.updatedCloudFormationResources = serverless.service.provider.compiledCloudFormationTemplate.Resources
            done()
        })

        it('should call #createCustomResourcesForEachFunctionWithSnsFilterDefinition()', () => {
            expect(this.updatedCloudFormationResources).to.have.any.keys(['ApplyhelloFunctionFilterPolicy'])
        })

        it('should merge the resources from #generateAddFilterPolicyLambdaResources()', () => {
            expect(this.updatedCloudFormationResources).to.have.any.keys('AddFilterPolicyLambdaFunction')
        })
    })

    describe('getLambdaFunctionCloudformationResourceKey()', () => {
        let resources = {
            HelloLambdaFunction: {
                Type: 'AWS::Lambda::Function',
                Properties: {
                    FunctionName: 'serverless-sns-filter-integration-test-dev-hello',
                }
            },
            SendMessageLambdaFunction: {
                Type: 'AWS::Lambda::Function',
                Properties: {
                    FunctionName: 'serverless-sns-filter-integration-test-dev-sendMessage',
                }
            }
        }
        let instance;

        beforeEach(() => {
            instance = new SnsFilterPlugin(serverless, {});
        })
        it('should return the key for the matching LambdaFunction', () => {
            let result = instance.getLambdaFunctionCloudformationResourceKey('serverless-sns-filter-integration-test-dev-hello', resources)
            expect(result).to.equal('HelloLambdaFunction')
        })
        it('should fail when no match found', () => {
            let call = () => instance.getLambdaFunctionCloudformationResourceKey('notFound', resources)
            expect(call).to.throw
        })
    })

    describe('#createCustomResourcesForEachFunctionWithSnsFilterDefinition()', () => {

        let instance;

        describe('when single filter defined', () => {
            beforeEach(async (done) => {

                serverless.service.functions = {
                    hello:
                        {
                            handler: 'handler.hello',
                            events:
                                [{
                                    sns: 'serverless-sns-filter-integration-test-greeter-dev',
                                    filter: { attrib_one: ['foo', 'bar'] }
                                }],
                            name: 'serverless-sns-filter-integration-test-dev-hello',
                        },
                    sendMessage:
                        {
                            handler: 'send.with_attribute',
                            events: [],
                            name: 'serverless-sns-filter-integration-test-dev-sendMessage',
                        },
                    sendFilteredMessage:
                        {
                            handler: 'send.without_attribute',
                            events: [],
                            name: 'serverless-sns-filter-integration-test-dev-sendFilteredMessage',
                        }
                };

                serverless.service.provider.compiledCloudFormationTemplate = sampleCompiledCloudformationTemplate;

                instance = new SnsFilterPlugin(serverless, {});

                await instance.createCustomResourcesForEachFunctionWithSnsFilterDefinition();
                done()
            })

            it('should create a Custom::ApplyFilterPolicy resource', () => {

                let cloudFormationResources = serverless.service.provider.compiledCloudFormationTemplate.Resources
                let customPolicies: Array<String> = Object.keys(cloudFormationResources).map(key => cloudFormationResources[key].Type).filter(type => type === 'Custom::ApplyFilterPolicy')

                expect(customPolicies.length).to.equal(1)
            })
        })

        describe('when multiple filters defined', () => {
            let filterForType = (cloudFormationResources, type) => _.pickBy(cloudFormationResources, value => value.Type === type)
            let expectedCustomResourceKeys = ['ApplyhelloFunctionFilterPolicy', 'ApplysendMessageFunctionFilterPolicy']

            beforeEach(async done => {
                let functionRef: ServerlessFunctionsAggregateDefinition = {
                    hello:
                        {
                            handler: 'unimportant',
                            events:
                                [{
                                    sns: 'serverless-sns-filter-integration-test-greeter-dev',
                                    filter: { attrib_one: ['foo', 'bar'] }
                                }],
                            name: 'serverless-sns-filter-integration-test-dev-hello',
                        },
                    sendMessage:
                        {
                            handler: 'unimportant',
                            events: [{
                                sns: 'serverless-sns-filter-integration-test-anotherTopic-dev',
                                filter: { attrib_two: ['baz'] }
                            }],
                            name: 'serverless-sns-filter-integration-test-dev-sendMessage',
                        },
                }

                serverless.service.functions = functionRef;

                serverless.service.provider.compiledCloudFormationTemplate = sampleCompiledCloudformationTemplate;

                instance = new SnsFilterPlugin(serverless, {});

                await instance.createCustomResourcesForEachFunctionWithSnsFilterDefinition();

                this.updatedCloudFormationResources = serverless.service.provider.compiledCloudFormationTemplate.Resources
                this.customPolicies = filterForType(this.updatedCloudFormationResources, 'Custom::ApplyFilterPolicy')
                done()
            })

            describe('generated Custom::ApplyFilterPolicy resources', () => {
                it('should create a Custom::ApplyFilterPolicy resource for each function with a filter_policy defined', () => {
                    expect(Object.keys(this.customPolicies).length).to.equal(2)
                })

                it('should generate the resource key based on the function key from serverless.yml', () => {
                    expect(this.customPolicies).to.have.keys(expectedCustomResourceKeys)
                })

                it('should generate ServiceToken, referencing the CustomResource Lambda', () => {
                    let expectedServiceToken = {
                        "Fn::GetAtt": "AddFilterPolicyLambdaFunction.Arn"
                    }
                    expectedCustomResourceKeys.forEach(key => {
                        expect(this.customPolicies[key].Properties.ServiceToken).to.deep.equal(expectedServiceToken)
                    })
                })

                it('should pass the region reference', () => {
                    let expectedRegion = { Ref: "AWS::Region" }
                    expectedCustomResourceKeys.forEach(key => {
                        expect(this.customPolicies[key].Properties.Region).to.deep.equal(expectedRegion)
                    })
                })

                it('should generate the sns_topicArn based on the topic for the function', () => {
                    let expectedTopicArnsForResourceKeys = [
                        [
                            'ApplyhelloFunctionFilterPolicy', {
                                "Fn::Join": [
                                    '', [
                                        "arn:aws:sns:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":serverless-sns-filter-integration-test-greeter-dev"
                                    ]
                                ]
                            }
                        ],
                        [
                            'ApplysendMessageFunctionFilterPolicy',
                            {
                                "Fn::Join": [
                                    '', [
                                        "arn:aws:sns:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":serverless-sns-filter-integration-test-anotherTopic-dev"
                                    ]
                                ]
                            }
                        ],
                    ]

                    expectedTopicArnsForResourceKeys.forEach(tuple => {
                        let key = tuple[0] as string
                        expect(this.customPolicies[key].Properties.sns_topicArn).to.deep.equal(tuple[1])
                    })
                })

            })


        })

    })

    describe('#customResourceForFn()', () => {
        let functionRef: ServerlessFunctionsAggregateDefinition = {
            hello:
                {
                    handler: 'unimportant',
                    events:
                        [{
                            sns: 'serverless-sns-filter-integration-test-greeter-dev',
                            filter: { attrib_one: ['foo', 'bar'] }
                        }],
                    name: 'serverless-sns-filter-integration-test-dev-hello',
                },
            sendMessage:
                {
                    handler: 'unimportant',
                    events: [{
                        sns: 'serverless-sns-filter-integration-test-anotherTopic-dev',
                        filter: { attrib_two: ['baz'] }
                    }],
                    name: 'serverless-sns-filter-integration-test-dev-sendMessage',
                },
        }
        let instance: SnsFilterPlugin;
        beforeEach(() => {
            instance = new SnsFilterPlugin(serverless, {});
            serverless.service.provider.compiledCloudFormationTemplate = sampleCompiledCloudformationTemplate;
        })

        describe('when generating Custom::ApplyFilterPolicy resource for hello function', () => {

            beforeEach(() => {
                let key = 'hello'
                this.expectedKey = 'ApplyhelloFunctionFilterPolicy'
                this.result = instance.customResourceForFn(key, functionRef[key])
                this.customResource = this.result[this.expectedKey]


            })
            it('should generate the resource key based on the function key from serverless.yml', () => {
                expect(this.result).to.have.keys(this.expectedKey)
            })

            it('should generate ServiceToken, referencing the CustomResource Lambda', () => {
                let expectedServiceToken = {
                    "Fn::GetAtt": "AddFilterPolicyLambdaFunction.Arn"
                }
                expect(this.customResource.Properties.ServiceToken).to.deep.equal(expectedServiceToken)
            })

            it('should pass the region reference', () => {
                let expectedRegion = { Ref: "AWS::Region" }
                expect(this.customResource.Properties.Region).to.deep.equal(expectedRegion)
            })

            it('should generate the sns_topicArn based on the topic for the function', () => {
                let expectedTopicArnsForResourceKeys = [
                    [
                        'ApplyhelloFunctionFilterPolicy', {
                            "Fn::Join": [
                                '', [
                                    "arn:aws:sns:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":serverless-sns-filter-integration-test-greeter-dev"
                                ]
                            ]
                        }
                    ],
                    [
                        'ApplysendMessageFunctionFilterPolicy',
                        {
                            "Fn::Join": [
                                '', [
                                    "arn:aws:sns:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":serverless-sns-filter-integration-test-anotherTopic-dev"
                                ]
                            ]
                        }
                    ],
                ]

                let expectedTopicArn = {
                    "Fn::Join": [
                        '', [
                            "arn:aws:sns:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":serverless-sns-filter-integration-test-greeter-dev"
                        ]
                    ]
                }

                expect(this.customResource.Properties.sns_topicArn).to.deep.equal(expectedTopicArn)
            })

            it('should generate the functionArn based on the function key', () => {
                let expectedFunctionArn = {
                    "Fn::Join": [
                        '', ['arn:aws:lambda:', { "Ref": "AWS::Region" }, ':', { "Ref": "AWS::AccountId" }, ':function:serverless-sns-filter-integration-test-dev-hello']
                    ]
                }
                expect(this.customResource.Properties.functionArn).to.deep.equal(expectedFunctionArn)
            })

            it('should include the filter_policy from the function definition', () => {
                expect(this.customResource.Properties.filter_policy).to.equal('{"attrib_one":["foo","bar"]}')
            })

            it('should depend on the function defintion', () => {
                expect(this.customResource.DependsOn).to.include('HelloLambdaFunction')
            })

            it('should depend on the corresponding function and topic', () => {
                console.log(this.customResource.DependsOn)
                expect(this.customResource.DependsOn).to.include('SNSTopicServerlesssnsfilterintegrationtestgreeterdev')
            })

        })

        describe('when generating Custom::ApplyFilterPolicy resource for sendMessage function', () => {

            beforeEach(() => {
                let key = 'sendMessage'
                this.expectedKey = 'ApplysendMessageFunctionFilterPolicy'
                this.result = instance.customResourceForFn(key, functionRef[key])
                this.customResource = this.result[this.expectedKey]


            })
            it('should generate the resource key based on the function key from serverless.yml', () => {
                expect(this.result).to.have.keys(this.expectedKey)
            })

            it('should generate ServiceToken, referencing the CustomResource Lambda', () => {
                let expectedServiceToken = {
                    "Fn::GetAtt": "AddFilterPolicyLambdaFunction.Arn"
                }
                expect(this.customResource.Properties.ServiceToken).to.deep.equal(expectedServiceToken)
            })

            it('should pass the region reference', () => {
                let expectedRegion = { Ref: "AWS::Region" }
                expect(this.customResource.Properties.Region).to.deep.equal(expectedRegion)
            })

            it('should generate the sns_topicArn based on the topic for the function', () => {
                let expectedTopicArnsForResourceKeys = [
                    [
                        'ApplyhelloFunctionFilterPolicy', {
                            "Fn::Join": [
                                '', [
                                    "arn:aws:sns:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":serverless-sns-filter-integration-test-greeter-dev"
                                ]
                            ]
                        }
                    ],
                    [
                        'ApplysendMessageFunctionFilterPolicy',
                        {
                            "Fn::Join": [
                                '', [
                                    "arn:aws:sns:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":serverless-sns-filter-integration-test-anotherTopic-dev"
                                ]
                            ]
                        }
                    ],
                ]

                let expectedTopicArn = {
                    "Fn::Join": [
                        '', [
                            "arn:aws:sns:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":serverless-sns-filter-integration-test-anotherTopic-dev"
                        ]
                    ]
                }

                expect(this.customResource.Properties.sns_topicArn).to.deep.equal(expectedTopicArn)
            })

            it('should generate the functionArn based on the function key', () => {
                let expectedFunctionArn = {
                    "Fn::Join": [
                        '', ['arn:aws:lambda:', { "Ref": "AWS::Region" }, ':', { "Ref": "AWS::AccountId" }, ':function:serverless-sns-filter-integration-test-dev-sendMessage']
                    ]
                }
                expect(this.customResource.Properties.functionArn).to.deep.equal(expectedFunctionArn)
            })

            it('should include the filter_policy from the function definition', () => {
                expect(this.customResource.Properties.filter_policy).to.equal('{"attrib_two":["baz"]}')
            })

        })

    })

    describe('#functionsWithSnsFilters()', () => {

        let instance: SnsFilterPlugin;

        beforeEach(() => {
            instance = new SnsFilterPlugin(serverless, {});

        })

        it('should return an empty list when the function ref has no sns filters defined', () => {
            let functionRef: ServerlessFunctionsAggregateDefinition = {
                hello:
                    {
                        handler: 'handler.hello',
                        events:
                            [{
                                sns: 'serverless-sns-filter-integration-test-greeter-dev',
                            }],
                        name: 'serverless-sns-filter-integration-test-dev-hello',
                    },
                sendMessage:
                    {
                        handler: 'send.with_attribute',
                        events: [{
                            sns: 'serverless-sns-filter-integration-test-greeter-dev',
                        }],
                        name: 'serverless-sns-filter-integration-test-dev-sendMessage',
                    },
            }

            let result = instance.functionsWithSnsFilters(functionRef)
            expect(result).to.be.instanceof(Array)
            expect(result).to.have.length(0)
        })

        it('should return a function ref with sns filters defined', () => {
            let functionRef: ServerlessFunctionsAggregateDefinition = {
                hello:
                    {
                        handler: 'handler.hello',
                        events:
                            [{
                                sns: 'serverless-sns-filter-integration-test-greeter-dev',
                                filter: { attrib_one: ['foo', 'bar'] }
                            }],
                        name: 'serverless-sns-filter-integration-test-dev-hello',
                    },
                sendMessage:
                    {
                        handler: 'send.with_attribute',
                        events: [{
                            sns: 'serverless-sns-filter-integration-test-greeter-dev',
                        }],
                        name: 'serverless-sns-filter-integration-test-dev-sendMessage',
                    },
            }

            let result = instance.functionsWithSnsFilters(functionRef)
            expect(result).to.be.instanceof(Array)
            expect(result).to.have.length(1)
            expect(result[0]).to.deep.equal(['hello', functionRef.hello])
        })

        it('should return all function ref with sns filters defined', () => {
            let functionRef: ServerlessFunctionsAggregateDefinition = {
                hello:
                    {
                        handler: 'handler.hello',
                        events:
                            [{
                                sns: 'serverless-sns-filter-integration-test-greeter-dev',
                                filter: { attrib_one: ['foo', 'bar'] }
                            }],
                        name: 'serverless-sns-filter-integration-test-dev-hello',
                    },
                noFilter:
                    {
                        handler: 'send.with_attribute',
                        events: [{
                            http: "GET hello",
                        }],
                        name: 'serverless-sns-filter-integration-test-dev-sendMessage',
                    },
                sendMessage:
                    {
                        handler: 'send.with_attribute',
                        events: [{
                            sns: 'serverless-sns-filter-integration-test-greeter-dev',
                            filter: { attrib_two: ['baz', 'boo'] }
                        }],
                        name: 'serverless-sns-filter-integration-test-dev-sendMessage',
                    },
            }

            let result = instance.functionsWithSnsFilters(functionRef)
            expect(result).to.be.instanceof(Array)
            expect(result).to.have.length(2)
            expect(result[0]).to.deep.equal(['hello', functionRef.hello])
            expect(result[1]).to.deep.equal(['sendMessage', functionRef.sendMessage])
        })
    })

    describe('#generateAddFilterPolicyLambdaResources()', () => {
        let instance: SnsFilterPlugin;

        beforeEach(async done => {
            serverless.service.provider.compiledCloudFormationTemplate = sampleCompiledCloudformationTemplate;
            let options = {
                stage: 'test'
            }
            instance = new SnsFilterPlugin(serverless, options);

            serverless.service.service = 'serviceName'
            this.generatedResources = await instance.generateAddFilterPolicyLambdaResources();
            done();
        })

        it('should add the resources from resources.yml', () => {
            expect(this.generatedResources).to.have.any.keys(['AddFilterPolicyLambdaFunction', 'AddFilterPolicyLogGroup'])
        })

        it('should generate AddFilterPolicyLambdaFunction name based on serverless project', () => {
            expect(this.generatedResources.AddFilterPolicyLambdaFunction.Properties.FunctionName).to.equal('serviceName-test-addFilterPolicy')
        })

        it('should generate the log group based on the function name', () => {
            expect(this.generatedResources.AddFilterPolicyLogGroup.Properties.LogGroupName).to.equal('/aws/lambda/serviceName-test-addFilterPolicy')
        })

        it('should generate the IamRoleAddFilterPolicyExecution policy name based on the service', () => {
            expect(this.generatedResources.IamRoleAddFilterPolicyExecution.Properties.Policies[0].PolicyName).to.equal('test-serviceName-addSnsFilterPolicyLambda')
        })

        it('should generate the IamRoleAddFilterPolicyExecution role name based on the service', () => {
            expect(this.generatedResources.IamRoleAddFilterPolicyExecution.Properties.RoleName).to.equal('serviceName-test-slsSnsFilterRole')
        })

        it('should limit IamRoleAddFilterPolicyExecution subscription modification only to the SNS topics that have filters applied')

    })

    describe('when SNS topic referenced by arn', () => {
        let instance: SnsFilterPlugin;
        beforeEach(() => {
            instance = new SnsFilterPlugin(serverless, {});
            serverless.service.provider.compiledCloudFormationTemplate = sampleCompiledCloudformationTemplate;
        })

        let functionRef: ServerlessFunctionsAggregateDefinition = {
            "helloPreexisting": {
                "handler": "handler.hello",
                "events": [
                    {
                        "sns": {
                            "arn": { "Fn::Join": ["", ["arn:aws:sns:ap-southeast-2:", { "Ref": "AWS::AccountId" }, ":prexisting-topic"]] },
                            "topicName": "prexisting-topic",
                        },
                        "filter": { "attrib_one": ["foo", "bar"] }
                    }
                ],
                "name": "sls-plugin-it-dev-helloPreexisting",
            },
            "helloPreexisting2": {
                "handler": "handler.hello",
                "events": [
                    {
                        "sns": {
                            "arn": "arn:aws:sns:ap-southeast-2:012345678901:prexisting-topic2",
                        },
                        "filter": { "attrib_one": ["foo", "bar"] }
                    }
                ],
                "name": "sls-plugin-it-dev-helloPreexisting2",
            },

        }

        describe('#customResourceForFn()', () => {
            it('should reference the arn directly when using a simple string', () => {
                let key = 'helloPreexisting2'
                this.expectedKey = 'ApplyhelloPreexisting2FunctionFilterPolicy'
                this.result = instance.customResourceForFn(key, functionRef[key])
                this.customResource = this.result[this.expectedKey]

                let expectedTopicArn = 'arn:aws:sns:ap-southeast-2:012345678901:prexisting-topic2'

                expect(this.customResource.Properties.sns_topicArn).to.deep.equal(expectedTopicArn)
            })

            it('should reference the arn directly when using a complex arn', () => {
                let key = 'helloPreexisting'
                this.expectedKey = 'ApplyhelloPreexistingFunctionFilterPolicy'
                this.result = instance.customResourceForFn(key, functionRef[key])
                this.customResource = this.result[this.expectedKey]
                let expectedTopicArn = { "Fn::Join": ["", ["arn:aws:sns:ap-southeast-2:", { "Ref": "AWS::AccountId" }, ":prexisting-topic"]] }

                expect(this.customResource.Properties.sns_topicArn).to.deep.equal(expectedTopicArn)

            })

            it('should not add a dependency on the topic', () => {
                expect(this.customResource.DependsOn).not.to.include('SNSTopicServerlesssnsfilterintegrationtestgreeterdev')
            })

            it('should add a dependency on the AWS::SNS::Subscription', () => {
                expect(this.customResource.DependsOn).to.include('HelloPreexistingSnsSubscriptionPrexistingtopic')
            })
        })

    })

    describe('#getAllSubscriptionResourceKeys', () => {
        describe('When no AWS::Topic::Subscriptions resources defined', () => {
            let noSubscriptionResources = {
                HelloLambdaFunction: {
                    Type: 'AWS::Lambda::Function',
                },
                SNSTopicServerlesssnsfilterintegrationtestgreeterdev: {
                    Type: 'AWS::SNS::Topic',
                },
            };

            let result: string[];
            let instance: SnsFilterPlugin;
            beforeEach( () => {
                instance = new SnsFilterPlugin(serverless, {});
                result = instance.getAllSubscriptionResourceKeys(noSubscriptionResources)
            })

            it('should return []', () => {
                expect(result).to.be.an('array').that.has.length(0)
            })

        })

        describe('When a single AWS::Topic::Subscriptions resources defined', () => {
            let noSubscriptionResources = {
                HelloLambdaFunction: {
                    Type: 'AWS::Lambda::Function',
                },
                SNSTopicServerlesssnsfilterintegrationtestgreeterdev: {
                    Type: 'AWS::SNS::Topic',
                },
                HelloPreexistingSnsSubscriptionPrexistingtopic: {
                    Type: 'AWS::SNS::Subscription',
                }
            };

            let result: string[];
            let instance: SnsFilterPlugin;
            beforeEach( () => {
                    instance = new SnsFilterPlugin(serverless, {});
                result = instance.getAllSubscriptionResourceKeys(noSubscriptionResources)
            })

            it('should return the resource key', () => {
                expect(result).to.be.an('array').that.has.length(1)
                expect(result).to.include('HelloPreexistingSnsSubscriptionPrexistingtopic')
            })

        })

        describe('When multiple AWS::Topic::Subscriptions resources defined', () => {
            let noSubscriptionResources = {
                HelloLambdaFunction: {
                    Type: 'AWS::Lambda::Function',
                },
                SNSTopicServerlesssnsfilterintegrationtestgreeterdev: {
                    Type: 'AWS::SNS::Topic',
                },
                subscription1: {
                    Type: 'AWS::SNS::Subscription',
                },
                subscription2: {
                    Type: 'AWS::SNS::Subscription',
                }
            };

            let result: string[];
            let instance: SnsFilterPlugin;
            beforeEach( () => {
                    instance = new SnsFilterPlugin(serverless, {});
                result = instance.getAllSubscriptionResourceKeys(noSubscriptionResources)
            })

            it('should return the resource key', () => {
                expect(result).to.include.members(['subscription1','subscription2'])
            })

        })
    })
})