/* globals EventTarget, THREE */
(function(exports){

// TODO: a peers management with data consolidation, lets see in v2.O ^^

const fetchLater = (url,delay)=> new Promise((ok,ko)=>
	setTimeout( url=> fetch(url)
						.then( res=> res.ok ? res.json() : ko(res.status) )
						.then( ok )
						.catch(ko)
	, delay, url)
)

var delay = (time,asyncFn,...args)=> 
				new Promise( (ok,ko)=>
					setTimeout( ()=>
						asyncFn(...args)
							.then(ok)
							.catch(ko)
					,	time)
				)
// var fetchLater = (url,time)=> delay( time, fetch, url )

var onDemand = function( asyncFn, ...args )
{
	let defer
	,	prom = new Promise((ok,ko)=>{
			defer = ()=> asyncFn( ...args ).then(ok).catch(ko)
		})
	prom.demanded = false
	prom.demand = ()=> (prom.demanded = true) && defer()
	return prom
}

// onDemand( fetch, url )

var fetcher = url=> {
	let prom
	if( url )
	{
		fetcher.queue.push( prom = onDemand(fetch, url) )
		prom = prom.then( res=> {//new Promise((ok,ko)=> {
		// fetcher.queue.push( prom = onDemand(fetch, url).then(res=>{
				setTimeout(()=>
					fetcher.queue.shift() && fetcher()
				,fetcher.delay)
				return res.ok ? res.json() : res.status
			})
		prom.labonne = 42
		// )

	}
	// if( typeof fetcher.queue[0] == 'string' )
	if( fetcher.queue.length && !fetcher.queue[0].demanded )
	{
		fetcher.queue[0].demand()
		// return fetcher.queue[0]
		// return fetcher.queue[0] = fetch( fetcher.queue[0] )
									// .then( res=> res.ok ? res.json() : ko(res.status) )
	}
	// else if( fetcher.queue.length )
		// return new Promise( (ok,ko)=>setTimeout( ()=>fetcher().then(ok).catch(ko) , 1000 ) )
		// return delay( 1000, fetcher )
	
	return prom
}
fetcher.delay = 1000
fetcher.queue = []

/**
 * Persistable class
 */

class Persistable extends THREE.EventDispatcher {
	constructor( data = {} )
	{
		super()
		Object.assign( this, data )
	}
	get _DB(){ return this.constructor.DB }
	toJSON()
	{
		const descs = Object.getOwnPropertyDescriptors(this.constructor.prototype)
		return Object.keys(descs)
					.filter( key=> descs[key].set )
					.map( key=> '_'+key )
					.concat( Object.keys( this ) 
								.filter( key=> key[0] != '_' )
					)
					.reduce( (res,key)=> (res[key] = this[key], res), {} )
	}
}


/**
 * Peer class
 */

class Peer extends Persistable {
	
	static get indices(){ return ['pubkey','currency'] }
	
	static get IP4_PATTERN() { return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/ }
	static get IP6_PATTERN() { return /^([\da-f]{1,4}:){3,7}[\da-f]{1,4}$/ }
	
	constructor( options = {} )
	{
		super( options )
		
		this._delay = Peer.DEFAULT_DELAY
		this._last = 0
		this._queue = []
		this._preferedEndpointType = Peer["Endpoint type"]
		this._preferedEndpoint = 0
		
		Object.assign( this, options )
		
		if( options.endpoints )
			this.endpoints = options.endpoints.map( s => {
				var v = s.split(' ');
				return {
					type: v.shift(),
					port: +v.pop(),
					domain: v.length && !~v[0].search(Peer.IP4_PATTERN) && !~v[0].search(Peer.IP6_PATTERN) ? v.shift() : null,
					// domain: v[1].indexOf('http')===0 ? v[1] : null,
					ip4: v.length && ~v[0].search(Peer.IP4_PATTERN) ? v.shift() : null,
					ip6: v.length && ~v[0].search(Peer.IP6_PATTERN) ? v.shift() : null
				}
			})
				.map( o => {
					Peer["Auto localization of ip"] && this.localize( o )
					return o
				})
	}
	
	get BMAUrls()
	{
		return ['BMAS','BASIC_MERKEL_API']
			.map( type=> 
				this.endpoints
					.filter( o=> o.type == type )
					.map( o=> {
							let https = o.port == 443
							,	protocol = https ? 'https' : 'http'
							,	port = https || o.port == 80 ? '' : ':' + o.port
							return `${protocol}://${o.domain || o.ip6 || o.ip4}${port}/` 
						})
			)
			.reduce( (list,arr)=>list.concat(arr), [] )
	}
	
	get url()
	{
		return this.BMAUrls[this._preferedEndpoint]
		// return this.endpoints
		// 			.filter( o=> o.type == this._preferedEndpointType )
		// 			.map( o=> {
		// 				let https = o.port == 443
		// 				,	protocol = https ? 'https' : 'http'
		// 				,	port = https || o.port == 80 ? '' : ':' + o.port
		// 				return `${protocol}://${o.domain || o.ip6 || o.ip4}${port}/` 
		// 			})[0]
					
	}
	
	get status(){ return this._status }
	set status( v )
	{
		if( this._status != v )
		{
			let oldStatus = this._status
			this._status = v
			this.dispatchEvent({ type: 'statusChanged', oldStatus, status: v })
		}
	}
	
	get endpoints(){ return this._endpoints }
	set endpoints( v )
	{
		this._endpoints = v.map( s => {
			if( typeof s != 'string')
				return s
			let strs = s.split(' ')
			return {
				type: strs.shift()
			,	port: +strs.pop()
			,	domain: strs.length && !~strs[0].search(Peer.IP4_PATTERN) && !~strs[0].search(Peer.IP6_PATTERN) ? strs.shift() : null
			//,	 domain: strs[1].indexOf('http')===0 ? strs[1] : null
			,	ip4: strs.length && ~strs[0].search(Peer.IP4_PATTERN) ? strs.shift() : null
			,	ip6: strs.length && ~strs[0].search(Peer.IP6_PATTERN) ? strs.shift() : null
			}
		})
			.map( o => {
				Peer["Auto localization of ip"] && this.localize( o )
				return o
			})
	}
	
	advanceQueue()
	{
		// if( last > delay ) advanceQueue in delay
		if( this._last + this._delay > Date.now() )
			setTimeout( this.advanceQueue.bind(this), this._last + this._delay - Date.now() + 10 )
		else
		{
			let prom = this._queue.shift()
			if( prom )
			{
				prom.loader.send()
				this._last = Date.now()
			}
		}
	}
	
	fetch( path )
	{
		const noCache = !!~path.indexOf('*')
		var url = this.url + path.replace(/\*/g,'')
		
		if( !noCache && localStorage[url] )
			// return new Promise( ok=> setTimeout( ok, 1, JSON.parse(localStorage[url]) ) )
			return new Promise( ok=> setTimeout( ok, 1, localStorage[url] ) )
							.then( text=> JSON.parse(text) )
							// .catch(err)
		let loader,
			swear = new Promise( (ok,ko)=>{
				
				// if( localStorage[url] )
					// return setTimeout( ok, 1, JSON.parse(localStorage[url]) );
				
				loader = new XMLHttpRequest();
				// loader.onload = e=> ok( JSON.parse(localStorage[url] = e.target.response) )
				loader.onload = e=> ok( loader.response )
				loader.onerror = e=> ko( {code: loader.status, message:loader.statusText} )
				// loader.addEventListener( 'load', e => ok( JSON.parse(localStorage[url] = e.target.response) ) );
				loader.open( 'GET', url );
				loader.setRequestHeader( "X-Requested-With", "XMLHttpRequest" );
				loader.setRequestHeader( "Accept", "application/json" );
				// loader.send();
				
			})
			.catch( err=> (this._preferedEndpoint++ && this.url) && this.fetch(path) || err ) // try again with another endpoint
			.then( text=> localStorage[url] = text )
			.then( text=> JSON.parse(text) )
			.then( json=> (this.advanceQueue(),json) )
		
		swear.loader = loader
		this._queue.push( swear )
		this.advanceQueue()
		
		return swear
	}
	
	localize( endpoint )
	{
		if( endpoint.ip && /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(endpoint.ip) )
			GET( 'http://ipinfo.io/' + endpoint.ip, d => {
				if( !d.loc ) return;
				var c = d.loc.split(',')
				endpoint.location = d
				endpoint.location.latitude = c[0]
				endpoint.location.longitude = c[1]
				this.dispatchEvent({ type: 'locationFound', endpoint, peer: this })
			} )
	}
	
}
Peer.DEFAULT_DELAY = 1000
	[Symbol.gui](	100 ,5000 ,name=>'Delay between xhr' )
Peer["Auto localization of ip"] = true
Peer["Endpoint type"] = 'BMAS'
		[Symbol.gui](	['BMAS','BASIC_MERKEL_API'] )


/**
 * Block class
 */
class Block extends Persistable {
	static get indices(){ return ['number','hash'] }
	
	// get identities() { return this._identities }
	get identities() { return this._identities.map(idty=>this._DB.accounts.find(idty)[0]) }
	set identities( v )
	{
		// debugger;
		this._identities = v.map( item=> {
			if( typeof item != 'string' ) return item
			let [ PUBLIC_KEY, SIGNATURE, BLOCK_UID, USER_ID ] = item.split(':')
			let idty = { pubkey:PUBLIC_KEY, identitySignature:SIGNATURE, sigBlock:BLOCK_UID, uid:USER_ID }
			setTimeout( data=>this._DB.updateOrInsert( this._DB.accounts, data ), 1, idty )
			return { pubkey:PUBLIC_KEY, uid:USER_ID }
		})
	}
	
	// get joiners() { return this._joiners }
	get joiners() { return this._joiners.map(idty=>this._DB.accounts.find(idty)[0]) }
	set joiners( v )
	{
		// debugger;
		this._joiners = v.map( item=> {
			if( typeof item != 'string' ) return item
			let [ PUBLIC_KEY, SIGNATURE, M_BLOCK_UID, I_BLOCK_UID, USER_ID ] = item.split(':')
			let idty = { pubkey:PUBLIC_KEY, identitySignature:SIGNATURE, sigBlock:I_BLOCK_UID, membershipBlock:M_BLOCK_UID, uid:USER_ID }
			setTimeout( data=>this._DB.updateOrInsert( this._DB.accounts, data ), 1, idty )
			return { pubkey:PUBLIC_KEY, uid:USER_ID }
		})
	}
	// get certifications() { return this._certifications }
	get certifications() { return this._certifications.map(cert=>this._DB.certifications.find(cert)[0]) }
	set certifications( v )
	{
		// debugger;
		this._certifications = v.map( item=> {
			if( typeof item != 'string' ) return item
			let [ PUBKEY_FROM, PUBKEY_TO, BLOCK_UID, SIGNATURE ] = item.split(':')
			let cert = { from:PUBKEY_FROM, to:PUBKEY_TO, sigBlock:BLOCK_UID, signature:SIGNATURE }
			setTimeout( data=>this._DB.updateOrInsert( this._DB.certifications, data ), 1, cert )
			return { from:PUBKEY_FROM, to:PUBKEY_TO, sigBlock:BLOCK_UID }
		})
	}
	// get transactions() { return this._transactions }
	// set transactions( v )
	// {
	// 	this._transactions = v.map( item=> {
	// 			if( typeof item != 'string' ) return item
	// 			let [ PUBLIC_KEY, SIGNATURE, BLOCK_UID, USER_ID ] = item.split(':')
	// 			return { PUBLIC_KEY, SIGNATURE, BLOCK_UID, USER_ID }
	// 		})
	// }
	set raw( v ) { /*void*/ }
}

/**
 * Account class
 */
class Account extends Persistable {
	static get indices(){ return ['pubkey','uid'] }
	static get unique(){ return ['pubkey'] }
	constructor( data = {} )
	{
		super( data )
		// Store global references
		// Account.all.push( Account[this.pubkey] = Account[this.uid] = this )
	}
	
	get sigDate() { return this._sigDate }
	set sigDate( v )
	{
		this._sigDate = v
		this.sigBlock = v.split('-')[0]
	}
	
	// set meta( v )
	// {
		// this._DB.blocks[v.time]
	// }
	// load()
	// {
	// 	// Get extra informations
	// 	// Dune.AUTOLOAD && 
	// 		this._blockchain.load( 'blockchain/memberships/' + this.uid, 
	// 			data => {
	// 				if( data.ucode ) return
	// 				Object.assign( this, data )
	// 				this.sigBlock = data.sigDate.split('-')[0]
	// 				// this._blockchain.blocks[this.sigBlock] = this._blockchain.blocks[this.sigBlock] || []
	// 				// this._blockchain.blocks[this.sigBlock].push( this )
					
	// 			})
		
	// 	this._blockchain.load( 'wot/certified-by/' + this.uid, 
	// 		memberInfo => {
				
	// 			if( memberInfo.ucode ) return;
				
	// 			Object.assign( this, memberInfo )
				
	// 			this.certifications.map( (cert,i) => {
	// 				// console.log("loadCertifications: ",cert)
	// 				// Account[cert.uid] && Account[cert.uid].madeCertifications.push( cert )
	// 				this.certifications[i] = this.createInteraction( cert )
	// 				// this.certifications[i].line.visible = false
	// 				// !this.certifications[i] 
	// 				//  && console.error(cert, cert.uid)
					
	// 				// this.certifications[i]
	// 				//  && blockchain.add( this.certifications[i] )
	// 			});
				
	// 			this.certifications = this.certifications
	// 											.filter( o => typeof o != 'undefined' )
	// 			// accounts.every( person => person.hasOwnProperty('certifications') )
	// 				// && initWoT()
	// 		})
	// }
	
	// get certifications() { return this._certifications }
	// set certifications( v )
	// {
	// 	v.map()
	// }
	
	// loadCertifications()
	// {
	//	 GET( dune.url + 'wot/certified-by/' + this.uid, 
	//		 memberInfo => {
	//			 Object.assign( this, memberInfo );
				
	//			 this.certifications.map( (cert,i) => {
	//				 // console.log("loadCertifications: ",cert);
	//				 // Account[cert.uid] && Account[cert.uid].madeCertifications.push( cert );
	//				 this.certifications[i] = this.createInteraction( cert );
	//				 // this.certifications[i].line.visible = false;
	//				 // !this.certifications[i] 
	//				 //  && console.error(cert, cert.uid);
					
	//				 // this.certifications[i]
	//				 //  && dune.add( this.certifications[i] );
	//			 });
				
	//			 this.certifications = this.certifications
	//											 .filter( o => typeof o != 'undefined' )
	//			 // accounts.every( person => person.hasOwnProperty('certifications') )
	//				 // && initWoT();
	//		 }
	//	 )
	// }
}
Account.AUTOLOAD_MEMBERSHIP = false
Account.all = [];


/**
 * Interaction class
 */

class Interaction extends Persistable {
	
}


/**
 * Transaction class
 */

class Transaction extends Interaction {
	static get indices(){ return ['from','to'] }
	
}


/**
 * Certification class
 */

class Certification extends Interaction {
	static get indices(){ return ['from','to','sigBlock'] }
}



/**
 * Blockchain class
 */

class PersistableDB extends THREE.EventDispatcher {
	constructor( ...models )
	{
		// Object.assign( this, EventTarget.prototype );
		super()
		this._models = []
		models.map( model=> this.addModel(model) )
	}
	
	addModel( model )
	{
		model.DB = this
		this._models.push( model )
	}
	
	openDatabase( name )
	{
		var idbAdapter = new LokiIndexedAdapter('WOoT');
		if( idbAdapter.checkAvailability() )
			// use paging only if you expect a single collection to be over 50 megs or so
			var pa = new loki.LokiPartitioningAdapter(idbAdapter, { paging: true });
		else
			var pa = new loki.LokiPartitioningAdapter(new loki.LokiMemoryAdapter(), { paging: true });
		
		return new Promise( (ok,ko)=>
			this.db = new loki( `${name}.db`, Object.assign({ 
				adapter: pa,
				autoload: true,
				autoloadCallback : ()=> { ok( this.db ); this.onDatabase() },
				autosave: true, 
				autosaveInterval: 4000
			}, this._models.reduce( (opt,model)=> {
					opt[model.name.toLowerCase()+'s'] = { proto: model }
					return opt
				},{}) )
				// peers: { proto: this._peerClass },
				// accounts: { proto: this._accountClass },
				// transactions: { proto: this._transactionClass },
			)
		)
	}
	
	onDatabase()
	{
		this._models.map( model=> {
			let col = model.name.toLowerCase()+'s'
			this[col] = this.db.getCollection( col )
						|| this.db.addCollection( col, {indices: model.indices, unique: model.unique} )
		
			// this[col].data.map( item=> item._DB = this )
		})
	}
	
	updateOrInsert( collection, data )
	{
		// let obj, toUpdate = collection.findObject( data )
		let obj
		,	toUpdate = data && collection.findObject(
				Object.keys( collection.binaryIndices )
					.reduce( (ex,key)=> (ex[key]=data[key],ex), {}  )
			)
		if( toUpdate )
		{
			Object.assign( toUpdate, data )
			// obj.$loki = toUpdate[0].$loki
			// obj.meta = toUpdate[0].meta
			// toUpdate._DB = this
			collection.update( toUpdate )
		}
		else {
			obj = new this.db.options[collection.name].proto( data )
			// obj._DB = this
			collection.insert( obj )
		}
		
		let type = (obj || toUpdate).constructor.name.toLowerCase()
		
		this.dispatchEvent({
			type:  type + (toUpdate ? 'Updated' : 'Added')	// peerAdded accountAdded ...
		,	[type]: obj || toUpdate 						// e.peer e.account ....
		})
		
		return obj || toUpdate
	}
}

/**
 * DUniterBlockchain class
 */
class DUniterBlockchain extends PersistableDB {
	constructor( url )
	{
		super( Peer, Block, Account, Certification, Transaction )
		this.url = url
		fetcher( `${url}blockchain/parameters` )
			.then( params=> this.parameters = params )
			.then( params=> this.openDatabase(params.currency) )
			
		// debugger;
	}
	
	
	loadBlock( from = 0, to = false )
	{
		return Promise.all([
			fetcher( `${this.url}blockchain/with/newcomers`)
				.then( json=> json.result.blocks )
		,	fetcher( `${this.url}blockchain/with/certs`)
				.then( json=> json.result.blocks )
		])
		.then( ([newcomers,certs])=> {
			// console.log(newcomers)
			// console.log(certs)
			let blocks = newcomers.concat( certs )
							.reduce( (a,n)=>(!~a.indexOf(n)&&a.push(n),a), [] )
							.filter( block=> from <=block && block <=to )
							.sort( (a,b)=> a > b )
			blocks.map( block=> 
				fetcher(`${this.url}blockchain/block/${block}`)
					.then( block=> {
						this.updateOrInsert( this.blocks, block )
					})
			)
		})
	}
	load( limit )
	{
		return fetchLater( `${this.url}wot/members`, 1 )
			.then( json=> json.results )
			.then( members=> Promise.all(
				(limit ? members.filter((m,i)=>i<limit) : members)
					.map( (m,i)=> fetchLater(`${this.url}wot/lookup/${m.pubkey}`, i*1000)
									.then( json=> 
										json.results
											.map( key=> {
												let m = key.uids[0] 
												m.pubkey = key.pubkey
												m.sigDate = m.meta.timestamp
												m.others.map( cert=> 
													this.updateOrInsert(this.certifications,
														Object.assign(cert,{receiver:m.uid})
													) 
												)
												delete m.others
												key.signed.map( cert=> 
													this.updateOrInsert(this.certifications,
														Object.assign(cert,{sender:key.pubkey})
													) 
												)
												this.updateOrInsert( this.accounts, m )
												return m
											})
									)
									
					)
			))
		
		return fetchLater( `${this.url}wot/members`, 1 )
			// .then( res=> res.ok && res.json() )
			.then( json=> this.members = json.results )
			.then( members=> Promise.all(
				(limit ? members.filter((m,i)=>i<limit) : members)
					.map(
					(m,i)=> Promise.all([
						fetchLater( `${this.url}blockchain/memberships/${m.pubkey}`, i*1000 )
					,	fetchLater( `${this.url}wot/certified-by/${m.pubkey}`, i*1000 )
					])
					.then( all=> (all.map(data=> Object.assign(m,data)),m) )
				)
			))
			.then( members=> members.map( m=> {
				this.updateOrInsert(this.accounts, m)
				m.certifications.map( cert=> this.updateOrInsert(this.certifications, cert) )
			}))
		return;
		let prom
		// Get the member list
		if( !this.accounts.count() )
			prom = this.fetch( "wot/members" )
				.then( data => data.results.map(guy=> this.updateOrInsert(this.accounts, guy)) )
		else
			prom = Promise.resolve()
		
		prom.then( ()=> {
			this.accounts.find({memberships:{$eq:undefined}})
				.map( guy => {
					// Get extra membership informations
					this.fetch( `blockchain/memberships/${guy.pubkey}` )
						.then( data => {
							if( !data || data.ucode ) return;
							Object.assign( guy, data )
							// guy.sigBlock = data.sigDate.split('-')[0]
							// guy._blockchain.blocks[guy.sigBlock] = guy._blockchain.blocks[guy.sigBlock] || []
							// guy._blockchain.blocks[guy.sigBlock].push( this )
							
						})
				})
					
			this.accounts.find({certifications:{$eq:undefined}})
				.map( guy => {
			
					// Get certifications
					this.fetch( `wot/certified-by/${guy.uid}` ) 
						.then( data => {
							if( !data || data.ucode ) return;
							
							Object.assign( guy, data )
							
							// guy.certifications.map( (cert,i) => {
								// console.log("loadCertifications: ",cert)
								// Account[cert.uid] && Account[cert.uid].madeCertifications.push( cert )
								// guy.certifications[i] = guy.createInteraction( cert )
								// guy.certifications[i].line.visible = false
								// !guy.certifications[i] 
								//  && console.error(cert, cert.uid)
								
								// guy.certifications[i]
								//  && blockchain.add( guy.certifications[i] )
							// });
							
							// guy.certifications = guy.certifications
															// .filter( o => typeof o != 'undefined' )
							// accounts.every( person => person.hasOwnProperty('certifications') )
								// && initWoT()
						})
				
				
				// if( DUniterBlockchain.AUTOLOAD_MEMBERSHIPS )//&& guy.uid == 'cgeek') 
					// guy.load()
				
				})
		})
	
	}
	
}
DUniterBlockchain.AUTOLOAD_MEMBERSHIPS = true
DUniterBlockchain.AUTOLOAD_MEMBER_CERTIFICATIONS = false
									[Symbol.gui](	name=>'Load members certifs' )


// exports.MedianPosition = MedianPosition
DUniterBlockchain.fetcher = fetcher
exports.Peer = Peer
exports.Account = Account
exports.Interaction = Interaction
exports.Certification = Certification
exports.Transaction = Transaction
exports.PersistableDB = PersistableDB
exports.DUniterBlockchain = DUniterBlockchain


})( window )