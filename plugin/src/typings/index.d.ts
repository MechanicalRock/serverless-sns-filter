interface ServerlessFunctionsAggregateDefinition {
    [functionName: string]: ServerlessFunctionBody
}

interface ServerlessFunctionBody {
    handler: string,
    events: Array<ServerlessEventDefinition>,
    name: string
}

interface ServerlessEventDefinition {

}
interface ServerlessSnsEventDefinition extends ServerlessEventDefinition {
    sns: any,
    filter?: SnsFilterPluginFilterDefinition
}

interface SnsFilterPluginFilterDefinition {
    [attributeName: string]: Array<string>
}