const hello = (event, context, callback) => {
  
  console.log(`message received: ${event.Records[0].Sns.Message}`);
  console.log(`messageId: ${event.Records[0].Sns.MessageId}`);
  console.log(`${JSON.stringify(event)}`);
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: "Go Serverless v1.0! Your function executed successfully!",
      input: event,
    }),
  };

  callback(null, response);

};

module.exports = {
  hello: hello
}
