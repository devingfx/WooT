/* globals EventTarget, THREE */
(function(exports){


class BlockReader extends THREE.EventDispatcher {
	constructor( db )
	{
		// Object.assign( this, EventTarget.prototype );
		super()
		
		this.DB = db
		this.playing = false
		this.blockNumber = -1
		this._frame = 0
		// this.blocks = []
		this._lastBlockFrame = 0
	}
	
	get block(){ return this.DB.blocks.findOne({number:this.blockNumber}) }
	
	play( fromBlock, quick )
	{
		this.blockNumber = typeof fromBlock != 'undefined' ? fromBlock-1 : -1;
		
		// if( quick )
		// {
			// this._quickMode = [];
			// for( var n in this.blocks )
				// this._quickMode.push(n);
		// }
		
		this.playing = true;
		this.dispatchEvent({ type: 'play' })
	}
	
	pause()
	{
		this.playing = false;
		this.dispatchEvent({ type: 'pause' })
	}
	
	seek()
	{ /* TODO */ }
	
	stop()
	{
		this.playing = false;
		this.dispatchEvent({ type: 'stop' })
	}
	
	reset()
	{
		this.blockNumber = -1;
		// delete this._quickMode;
		// this.accounts.map( child => this.removeAccount(child) ); //TODO: avoid sending events
		// this._accounts.map( guy => guy.reset() )
		this.dispatchEvent({ type: 'reset' })
	}
	
	update()
	{
		this._frame++
		// Blockchain time block
		if( this.playing && this._frame - this._lastBlockFrame > BlockReader.BLOCK_FRAMERATE )
		{
			this._lastBlockFrame = this._frame
			this.blockNumber++
			// if( this._quickMode && this._quickMode.length )
			// {
				// this.blockNumber = this._quickMode.shift()
			// }
			console.info( 'Block time: ' + this.blockNumber )
			// this.onBlockTime()
			this.dispatchEvent({ type: 'block', block: this.block })
		}
		
		// requestAnimationFrame( this.animate.bind(this) );
	}
	
	// onBlockTime()
	// {
	// 	document.querySelector('#block-number').innerText = this.blockNumber;
	// 	this.block.map( (obj,i) => {
	// 		this.add( obj )
	// 	})
	// }
	
}
BlockReader.BLOCK_FRAMERATE = 100;
BlockReader.stepFrequency = 60;
BlockReader.maxSubSteps = 3;


exports.BlockReader = BlockReader


})( window )