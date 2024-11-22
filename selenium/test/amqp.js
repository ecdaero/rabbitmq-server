var container = require('rhea')  // https://github.com/amqp/rhea
var fs = require('fs');
var path = require('path');

function getAmqpConnectionOptions() {
  return {
    'host': process.env.RABBITMQ_HOSTNAME || 'rabbitmq',
    'port': process.env.RABBITMQ_AMQP_PORT || 5672,
    'username' : process.env.RABBITMQ_AMQP_USERNAME || 'guest',
    'password' : process.env.RABBITMQ_AMQP_PASSWORD || 'guest',
    'id': "selenium-connection-id",
    'container_id': "selenium-container-id"        
  }
}
function getAmqpsConnectionOptions() {
  let options = getAmqpConnectionOptions()
  let useMtls = process.env.AMQP_USE_MTLS || false
  if (useMtls) {
    options['enable_sasl_external'] = true  
  }
  options['transport'] = 'tls'
  let certsLocation = getEnv("RABBITMQ_CERTS");
  options['key'] = fs.readFileSync(path.resolve(certsLocation,'client_rabbitmq_key.pem'))
  options['cert'] = fs.readFileSync(path.resolve(certsLocation,'client_rabbitmq_certificate.pem'))
  options['ca'] = fs.readFileSync(path.resolve(certsLocation,'ca_rabbitmq_certificate.pem')) 
}
module.exports = {
  open: () => {
    switch(process.env.RABBITMQ_AMQP_SCHEME || 'amqp'){
      case 'amqp':
        return container.connect(getAmqpConnectionOptions())
      case 'amqps':
        return container.connect(getAmqpsConnectionOptions())
    }    
  }
}