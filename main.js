
// log.info('Starting ServiceNow Adapter');

// Import built-in Node.js package path.
const path = require('path');

/**
 * Import the ServiceNowConnector class from local Node.js module connector.js
 *   and assign it to constant ServiceNowConnector.
 * When importing local modules, IAP requires an absolute file reference.
 * Built-in module path's join method constructs the absolute filename.
 */
const ServiceNowConnector = require(path.join(__dirname, '/connector.js'));

/**
 * Import built-in Node.js package events' EventEmitter class and
 * assign it to constant EventEmitter. We will create a child class
 * from this class.
 */
const EventEmitter = require('events').EventEmitter;

/**
 * The ServiceNowAdapter class.
 *
 * @summary ServiceNow Change Request Adapter
 * @description This class contains IAP adapter properties and methods that IAP
 *   brokers and products can execute. This class inherits the EventEmitter
 *   class.
 */
class ServiceNowAdapter extends EventEmitter {

  /**
   * Here we document the ServiceNowAdapter class' callback. It must follow IAP's
   *   data-first convention.
   * @callback ServiceNowAdapter~requestCallback
   * @param {(object|string)} responseData - The entire REST API response.
   * @param {error} [errorMessage] - An error thrown by REST API call.
   */

  /**
   * Here we document the adapter properties.
   * @typedef {object} ServiceNowAdapter~adapterProperties - Adapter
   *   instance's properties object.
   * @property {string} url - ServiceNow instance URL.
   * @property {object} auth - ServiceNow instance credentials.
   * @property {string} auth.username - Login username.
   * @property {string} auth.password - Login password.
   * @property {string} serviceNowTable - The change request table name.
   */

  /**
   * @memberof ServiceNowAdapter
   * @constructs
   *
   * @description Instantiates a new instance of the Itential ServiceNow Adapter.
   * @param {string} id - Adapter instance's ID.
   * @param {ServiceNowAdapter~adapterProperties} adapterProperties - Adapter instance's properties object.
   */
  constructor(id, adapterProperties) {
    // Call super or parent class' constructor.
    super();
    // Copy arguments' values to object properties.
    this.id = id;
    this.props = adapterProperties;
    // Instantiate an object from the connector.js module and assign it to an object property.
    this.connector = new ServiceNowConnector({
      url: this.props.url,
      username: this.props.auth.username,
      password: this.props.auth.password,
      serviceNowTable: this.props.serviceNowTable
    });
  }

  /**
   * @memberof ServiceNowAdapter
   * @method connect
   * @summary Connect to ServiceNow
   * @description Complete a single healthcheck and emit ONLINE or OFFLINE.
   *   IAP calls this method after instantiating an object from the class.
   *   There is no need for parameters because all connection details
   *   were passed to the object's constructor and assigned to object property this.props.
   */
  connect() {
    // As a best practice, Itential recommends isolating the health check action
    // in its own method.
    this.healthcheck();
  }

  /**
   * @memberof ServiceNowAdapter
   * @method healthcheck
   * @summary Check ServiceNow Health
   * @description Verifies external system is available and healthy.
   *   Calls method emitOnline if external system is available.
   *
   * @param {ServiceNowAdapter~requestCallback} [callback] - The optional callback
   *   that handles the response.
   */
  healthcheck(callback) {
    this.getRecord((result, error) => {
      if (error) {
        this.emitOffline();
        log.error(`ServiceNow: ${this.id} failed healthcheck: ${JSON.stringify(error)}`);
        log.debug(`ServiceNow: ${this.id} healthcheck result was: ${JSON.stringify(result)}`);
      } else {
        this.emitOnline();
        log.debug(`ServiceNow: ${this.id} healthcheck passed`);
      }
      if (typeof callback !== 'undefined') {
        callback(result, error)
      }
    });
  }

  /**
   * @memberof ServiceNowAdapter
   * @method emitOffline
   * @summary Emit OFFLINE
   * @description Emits an OFFLINE event to IAP indicating the external
   *   system is not available.
   */
  emitOffline() {
    this.emitStatus('OFFLINE');
    log.warn('ServiceNow: Instance is unavailable.');
  }

  /**
   * @memberof ServiceNowAdapter
   * @method emitOnline
   * @summary Emit ONLINE
   * @description Emits an ONLINE event to IAP indicating external
   *   system is available.
   */
  emitOnline() {
    this.emitStatus('ONLINE');
    log.info('ServiceNow: Instance is available.');
  }

  /**
   * @memberof ServiceNowAdapter
   * @method emitStatus
   * @summary Emit an Event
   * @description Calls inherited emit method. IAP requires the event
   *   and an object identifying the adapter instance.
   *
   * @param {string} status - The event to emit.
   */
  emitStatus(status) {
    this.emit(status, { id: this.id });
  }

/**
   * Here we document generic change ticket properties.
   * @typedef {object} ServiceNowAdapter~genericChange - Change Ticket
   *   properties object
   * @property {string} change_ticket_number - friendly ticket number
   * @property {object} active 
   * @property {string} priority
   * @property {string} description
   * @property {string} work_start
   * @property {string} work_end
   * @property {string} change_ticket_key - internal ticket identifier
   */

  /**
   * @memberof ServiceNowAdapter
   * @method TransformChangeRecord
   * @summary Transform ServiceNow Record into generic change ticket model
   * @description Mutates an array of objects to match generic model for change tickets
   * 
   * @param {Object} changeTicket - ServiceNow Change Ticket document to be transformed
   */
  TransformChangeRecord(ServiceNowChange) {
  
    let genericChange = new Object
    let property_map = { 
      'number': 'change_ticket_number',
      'active': 'active',
      'priority': 'priority',
      'description': 'description',
      'work_start': 'work_start',
      'work_end': 'work_end',
      'sys_id' : 'change_ticket_key'
    }
    for (const p of Object.keys(ServiceNowChange)) {
      if (p in property_map) {
        genericChange[property_map[p]] = ServiceNowChange[p];
      }
    }
    return genericChange
  }

  /**
   * @memberof ServiceNowAdapter
   * @method getRecord
   * @summary Get ServiceNow Record
   * @description Retrieves a record from ServiceNow.
   *
   * @param {ServiceNowAdapter~requestCallback} callback - The callback that
   *   handles the response.
   */
  getRecord(callback) {
    
    this.connector.get((data, error) => {
      if ((typeof data == 'Object') && ('body' in data)) {
        log.trace(`ServiceNow: ${this.id} POST response: ${data.body}`)
        genericChange = TransformChangeRecord(JSON.parse(data.body))
        data.body = JSON.stringify(genericChange)
        log.spam(`ServiceNow: ${this.id} transformed response: ${data.body}`)
      }
      callback(data, error)
    });
  }

  /**
   * @memberof ServiceNowAdapter
   * @method postRecord
   * @summary Create ServiceNow Record
   * @description Creates a record in ServiceNow.
   *
   * @param {ServiceNowAdapter~requestCallback} callback - The callback that
   *   handles the response.
   */
  postRecord(callback) {

    this.connector.post((data, error) => {
      if ((typeof data == 'Object') && ('body' in data)) {
        log.trace(`ServiceNow: ${this.id} POST response: ${data.body}`)
        genericChange = TransformChangeRecord(JSON.parse(data.body))
        data.body = JSON.stringify(genericChange)
        log.spam(`ServiceNow: ${this.id} transformed response: ${data.body}`)
      }
      callback(data, error)
    });
  }

}

module.exports = ServiceNowAdapter;
