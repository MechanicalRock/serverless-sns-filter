import { Serverless } from 'serverless'
import * as path from 'path'
import * as _ from 'lodash'
    
export class SnsFilterPlugin {
    options: any;
    serverless: any;
    hooks: any;
    provider: any;
    functionRefs: any;

    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options
        this.hooks = {
            'after:aws:package:finalize:mergeCustomProviderResources': this.createDeploymentArtifacts
        }

        this.provider = this.serverless.getProvider('AWS');
        this.functionRefs = this.serverless.service.functions
    }

    getTopicCloudformationResourceKey = (topicName: string, resources: any): string => {
        let topic = (keypair) => keypair[1].Type === 'AWS::SNS::Topic'
        let matchingName = (keypair) => keypair[1].Properties.TopicName === topicName
        let keypair = _.toPairs(resources).filter(topic).find(matchingName)
        if (!keypair) {
            // should not happen
            // throw new Error(`No matching AWS::Lambda::Function with name ${functionName} found`)
            keypair = ['unknown', 'unknown']
        }
        return keypair[0]
    }

    getLambdaFunctionCloudformationResourceKey = (functionName: string, resources: any): string => {
        let lambdaFunctions = (keypair) => keypair[1].Type === 'AWS::Lambda::Function'
        let matchingName = (keypair) => keypair[1].Properties.FunctionName === functionName
        let keypair = _.toPairs(resources).filter(lambdaFunctions).find(matchingName)
        if (!keypair) {
            // should not happen
            // throw new Error(`No matching AWS::Lambda::Function with name ${functionName} found`)
            keypair = ['unknown', 'unknown']
        }
        return keypair[0]

    }

    customResourceForFn = (functionKey: string, functionDef: ServerlessFunctionBody) => {
        let matchingSnsFilter = (event: ServerlessSnsEventDefinition | any) => (event.sns && event.filter);

        // Currently only support a single SNS filter
        let matchingSnsEvent = (functionDef.events.find(matchingSnsFilter) as ServerlessSnsEventDefinition)
        let filterPolicy = matchingSnsEvent.filter;
        let functionName = functionDef.name;
        let depenendencies = ['AddFilterPolicyLambdaFunction',this.getLambdaFunctionCloudformationResourceKey(functionName, this.serverless.service.provider.compiledCloudFormationTemplate.Resources)]
        
        let snsTopicArn;
        if(matchingSnsEvent.sns.arn){
            snsTopicArn = matchingSnsEvent.sns.arn
        }else{
            snsTopicArn = {
                "Fn::Join": [
                    '', [
                        "arn:aws:sns:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, `:${matchingSnsEvent.sns}`
                    ]
                ]
            }
            let snsTopicName = matchingSnsEvent.sns;
            let topicRef = this.getTopicCloudformationResourceKey(snsTopicName, this.serverless.service.provider.compiledCloudFormationTemplate.Resources)
            depenendencies.push(topicRef)
        }

        let applyFilterPolicyCustomResource = {
            Type: 'Custom::ApplyFilterPolicy',
            Properties: {
                ServiceToken: {
                    "Fn::GetAtt": "AddFilterPolicyLambdaFunction.Arn"
                },
                Region: { Ref: "AWS::Region" },
                sns_topicArn: snsTopicArn,
                functionArn: {
                    "Fn::Join": [
                        '', ["arn:aws:lambda:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, `:function:${functionName}`]
                    ]
                },
                filter_policy: JSON.stringify(filterPolicy),
            },
            DependsOn: depenendencies

            
        }
        let keyName = `Apply${functionKey}FunctionFilterPolicy`

        return { [keyName]: applyFilterPolicyCustomResource }
    }

    createCustomResourcesForEachFunctionWithSnsFilterDefinition = () => {
        let compiledCloudFormationTemplateResources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources
        this.functionsWithSnsFilters(this.functionRefs).forEach((keyToFnPair) => {
            let customResource = this.customResourceForFn(keyToFnPair[0], keyToFnPair[1])
            _.merge(compiledCloudFormationTemplateResources, customResource)
        })
    }

    createDeploymentArtifacts = async () => {
        let compiledCloudFormationTemplateResources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources
        this.createCustomResourcesForEachFunctionWithSnsFilterDefinition()
        let resources = await this.generateAddFilterPolicyLambdaResources()

        _.merge(compiledCloudFormationTemplateResources,resources)
    }

    /*
     * Returns an array of pairs of ['functionKey', functionDefinition]  that contain an SNS Filter.
     * Each functionKey refers to the reference in the serverless.yml
     * Matches the structure in the serverless.yml
     */
    functionsWithSnsFilters = (functionsRef: ServerlessFunctionsAggregateDefinition) => {
        let matchingSnsFilter = (event: ServerlessSnsEventDefinition | any) => (event.sns && event.filter)
        let fnKeyToFnPairs = _.toPairs(functionsRef).filter(keypair => keypair[1].events.some(matchingSnsFilter))
        return fnKeyToFnPairs;
    }

    getAddFilterPolicyLambdaFunctionName = () => {
        return `${this.serverless.service.service}-${this.options.stage}-addFilterPolicy`
    }

    updateAddFilterPolicyLambdaFunction = (addFilterPolicyLambdaFunction) => {
        let properties = addFilterPolicyLambdaFunction.Properties
        properties.FunctionName = this.getAddFilterPolicyLambdaFunctionName()
    }

    updateLogGroup = (logGroup) => {
        logGroup.Properties.LogGroupName=`/aws/lambda/${this.getAddFilterPolicyLambdaFunctionName()}`
    }

    updateIamRoleAddFilterPolicyExecution = (iamRole) => {
        iamRole.Properties.Policies[0].PolicyName = `${this.options.stage}-${this.serverless.service.service}-addSnsFilterPolicyLambda`
        iamRole.Properties.RoleName = `${this.serverless.service.service}-${this.options.stage}-slsSnsFilterRole`
    }

    async generateAddFilterPolicyLambdaResources(): Promise<any> {
        let resources = (await this.serverless.yamlParser.parse(path.resolve(__dirname, "..", 'resources.yml'))).Resources
        this.updateAddFilterPolicyLambdaFunction(resources.AddFilterPolicyLambdaFunction)
        this.updateLogGroup(resources.AddFilterPolicyLogGroup)
        this.updateIamRoleAddFilterPolicyExecution(resources.IamRoleAddFilterPolicyExecution)
        return resources
    }
}

module.exports = {
    SnsFilterPlugin: SnsFilterPlugin
}