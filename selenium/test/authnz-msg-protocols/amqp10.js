const assert = require('assert')
const { tokenFor, openIdConfiguration } = require('../utils')
const { reset, expectUser, expectVhost, expectResource, allow, verifyAll } = require('../mock_http_backend')
const {execSync} = require('child_process')

var container = require('rhea')  // https://github.com/amqp/rhea
var receivedAmqpMessageCount = 0
var untilConnectionEstablished = new Promise((resolve, reject) => {
  container.on('connection_open', function(context) {
    resolve()
  })
})

container.on('message', function (context) {
    receivedAmqpMessageCount++
})
container.once('sendable', function (context) {
    context.sender.send({body:'first message'})    
})

const profiles = process.env.PROFILES || ""
var backends = ""
for (const element of profiles.split(" ")) {
  if ( element.startsWith("auth_backends-") ) {
    backends = element.substring(element.indexOf("-")+1)
  }
}

describe('Having AMQP 1.0 protocol enabled and the following auth_backends: ' + backends, function () {
  let expectations = []
  let username = process.env.RABBITMQ_AMQP_USERNAME
  let password = process.env.RABBITMQ_AMQP_PASSWORD
  let usemtls = process.env.AMQP_USE_MTLS
  let amqpClientCommand = "npm run amqp10_roundtriptest" + 
    (usemtls ? "" : " " + username + " " + password)
  
  before(function () {
    if (backends.includes("http") && username.includes("http")) {
      reset()
      expectations.push(expectUser({ "username": username, "password": password}, "allow"))
      expectations.push(expectVhost({ "username": username, "vhost": "/"}, "allow"))
      expectations.push(expectResource({ "username": username, "vhost": "/", "resource": "queue", "name": "my-queue", "permission":"configure", "tags":""}, "allow"))
      expectations.push(expectResource({ "username": username, "vhost": "/", "resource": "queue", "name": "my-queue", "permission":"read", "tags":""}, "allow"))
      expectations.push(expectResource({ "username": username, "vhost": "/", "resource": "exchange", "name": "amq.default", "permission":"write", "tags":""}, "allow"))
    }else if (backends.includes("oauth") && username.includes("oauth")) {
      let oauthProviderUrl = process.env.OAUTH_PROVIDER_URL
      let oauthClientId = process.env.OAUTH_CLIENT_ID
      let oauthClientSecret = process.env.OAUTH_CLIENT_SECRET
      console.log("oauthProviderUrl  : " + oauthProviderUrl)
      let openIdConfig = openIdConfiguration(oauthProviderUrl)
      console.log("Obtained token_endpoint : " + openIdConfig.token_endpoint)
      password = tokenFor(oauthClientId, oauthClientSecret, openIdConfig.token_endpoint)
      console.log("Obtained access token : " + password)
    }
  })

  it('can open an AMQP 1.0 connection', async function () {     
    connection = container.connect(
      {'host': process.env.RABBITMQ_HOSTNAME || 'rabbitmq',
       'port': process.env.RABBITMQ_AMQP_PORT || 5672,
       'username' : process.env.RABBITMQ_AMQP_USERNAME || 'guest',
       'password' : process.env.RABBITMQ_AMQP_PASSWORD || 'guest',
       'id': "selenium-connection-id",
       'container_id': "selenium-container-id",
       'scheme': process.env.RABBITMQ_AMQP_SCHEME || 'amqp',
       //enable_sasl_external:true,
       
      })
    connection.open_receiver({
      source: 'examples',
      target: 'receiver-target',
      name: 'receiver-link'
    })
    sender = connection.open_sender({
      target: 'examples',
      source: 'sender-source',
      name: 'sender-link'
    })
    await untilConnectionEstablished
    var untilMessageReceived = new Promise((resolve, reject) => {
      container.on('message', function(context) {
        resolve()
      })
    })
    sender.send({body:'second message'})    
    await untilMessageReceived
    assert.equal(2, receivedAmqpMessageCount)

    //console.log(execSync(amqpClientCommand).toString())
  })

  after(function () {
      if ( backends.includes("http") ) {
        verifyAll(expectations)
      }
  })
})
