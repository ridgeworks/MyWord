// -- markit: framework module for publishing markup to HTML, contains MyWord ----

/*	The MIT License (MIT)
 *
 *	Copyright (c) 2016 Peter Cashin, Rick Workman
 *
 *	Permission is hereby granted, free of charge, to any person obtaining a copy
 *	of this software and associated documentation files (the "Software"), to deal
 *	in the Software without restriction, including without limitation the rights
 *	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *	copies of the Software, and to permit persons to whom the Software is
 *	furnished to do so, subject to the following conditions:
 *
 *	The above copyright notice and this permission notice shall be included in all
 *	copies or substantial portions of the Software.
 *
 *	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *	SOFTWARE.
 */

;(function () {

	/*
	 *  0. Some helper functions for I/O
	 */

	var loadpath = ['']                 // base for relative URLs, acts like a stack

	function directory(url) {
		return url.substring(0, url.lastIndexOf('/') + 1)
	} // directory(url)

	function composeURL(path) {
		var url = path.trim()
		return ((url.charAt(0) === '/') || (url.indexOf('://') > 0)) ?
			url :				// partial or absolute URL
			loadpath[0] + url	// relative URL
	} // composeURL(path)

	function fileContent(url) { // returns content or throws exception
		var status = 0
		if (typeof XMLHttpRequest != 'undefined') {
			var request = new XMLHttpRequest();
			request.open("GET", url, false);   //synchronous IO, requires Worker mode in browsers
			request.onerror = function () {
				status = 404
			}
			request.send()   //; console.log(request.status,url,"["+request.responseText.length+"]")
			status = ((status == 0) ? request.status : status )   //; console.log("status=",status)
			if ((status === 200 || status === 0)) {
				//console.log(url+"["+request.responseText.length+"]="+request.responseText.slice(0,48))
				return request.responseText
			} else {
				throw new Error(["Reading '", url, "':\n\t status=", status].join(''))
				//ES6: throw new Error(`Reading '${url}' status=${status}`)
			}
		} else {	// try Nodejs file system
			return fs.readFileSync(url, "utf8");
		}
	} // fileContent(url)

	function loadScript(url) {
		if (typeof importScripts != 'undefined') {
			importScripts(url)
		} else {
			// need to ensure global translators are accessible via global space
			// using require() problematic: no global name, relative url needs ./
			// fails in some cases?:	 new Function(fileContent(url))()
			var geval = eval; geval(fileContent(url))	// eval() in global scope, independent of module scheme
		}
	} // loadScript(url)


	/*
	 *  1. Init environment - load Grit and if executing as a Worker, setup message handler
	 */

	var workerMode = false 		// Note, due to syncIO, file ops only work in Worker mode
	var workerID = ''
	var Grit
	// Set workerMode; true if functioning as a Worker
	try {
		workerMode = (self instanceof WorkerGlobalScope)
	} catch (err) {}

	if (workerMode) {// When used in Worker mode
		// Load Grit - 	grit.js assumed to be co-located
		try {
			importScripts(directory(location.href) + "grit.js")
		} catch (err) {
			throw new Error(["loading grit.js: ", err.message].join(''))
		}
		Grit = self.Grit
		onmessage = function (msg) {
			var html                 //; console.log("Worker:" + workerID + " received request for " + msg.data[0])
			try {
				loadpath = [directory(msg.data[0])]   		// msg.data is [doc.href, transform, content]
				html = markit(msg.data[1], msg.data[2])   	// see markit() for spec
			} catch (err) {
				html = markit('errorString', err.message)
			}
			loadpath = ['']
			postMessage(html)
		}
		workerID = Date.now()
	} else {	// Node.js & CommonJS module system
		try {
			var fs = require('fs')
			// Load Grit - 	grit.js assumed to be co-located
			Grit = require("./grit.js")
			// define self for transform lookup
			if (typeof self == 'undefined')
				global.self = global
		} catch (err) {
			throw new Error(["Unsupported platform - upgrade browser or use CommonJS module system: ", err.message].join(''))
		}
	}
	console.log("Worker:" + workerID)


	/*
	 *  2. Context class for managing defs
	 */

	var Ctx = function (parent, blks) {
		this.parent = parent;	// link to parent context, null if root
		this.blks = blks;    	// from parse tree, no access methods
		this.index = {};   		// label to dataType map
		this.types = {}    		// dataType to transform map
	} // new Ctx(parent)

	Ctx.prototype = {};

	// create a new (nested) context for blks
	Ctx.prototype.push = function (blks) {
		return new Ctx(this, blks)
	} // Ctx.push(blks)

	// return parent context
	Ctx.prototype.pop = function () {
		return this.parent
	} // Ctx.pop()

	// add new label definition : (will overwrite if duplicate)
	Ctx.prototype.addLabelDef = function (label, labelDef) {
		this.index[label] = labelDef
	} // Ctx.addLabelDef(label, dataType)

	// lookup label definition associated with a label
	Ctx.prototype.labelDef = function (label) {
		var ldef = this.index[label]
		if (ldef) return ldef;
		if (this.parent) return this.parent.labelDef(label);
		return null
	} // Ctx.labelDef(label)

	// add new transform name and associate it with a transform (will overwrite if duplicate)
	Ctx.prototype.addTransform = function (name, transform) {
		this.types[name] = transform
	} // Ctx.addTransform(name, transform)

	// lookup a transform associated with name
	Ctx.prototype.transform = function (name) {                  // lookup data-type translator fn
		if (name) {
			var transform = this.types[name]                        // first search context chain
			if (transform) return transform                         // found in this context
			if (this.parent) return this.parent.transform(name);    // found in parrent context
			try {                                                   // global translators are transforms
				var t = eval("self." + name)		//; console.log(workerID + ":globalTranslator(", name, ")=", t)
				if (typeof t == 'function') return t
			} catch (err) {
			}	                                    // ignore errors
		}
		return null			                                    // any errors result in null
	} // Ctx.transform(name)

	// Create empty root context and add framework dataTypes
	var context = new Ctx(null, []);

	context.addTransform('text', function (content) {					// dataType for escaping text in HTML text nodes
		return content.replace(/</g, '&lt;')
	})

	context.addTransform('errorString', function (content) {			// dataType for error messages put in HTML output
		console.error(["markit(", workerID, "):", content].join(''))
		return ["<pre><mark style='color:blue'>\n*** Error *** ", markit('text', content), "\n</mark></pre>"].join('')
		//ES6:  `<pre><mark style='color:blue'>\n*** Error *** ${markit('text', content)}\n</mark></pre>`
	})


	/*
	 *  3. Global function : markit(transform, content)
	 *  returns html string or null(no transform function found)
	 *  throws Error if transform does or if transform doesn't return a string
	 */

	function markit(transform, content) {
		var html = null
		if (transform) {
			var translator = context.transform(transform)     //; console.log(transform,"=",translator)
			if (translator) {
				html = translator.call(null, content)	  	// Note: exceptions not caught inside markit()
			} else {
				console.log("missing translator", transform)
			}
		} else {
			console.log("missing transform", content)
		}
		if ((html) && (typeof html !== 'string')) { // Expecting an HTML fragment
			throw new Error(
				["Bad result from transform for type '", transform, "' => ", JSON.stringify(html)].join());
			//`Bad result from transform for type '${transform}' => ${JSON.stringify(html)}`);
		}
		return html
	} // markit(transform, content)


	/*
	 *  4. compileGrammar(grammar)
	 *  compile a grammar and throw an Error if errors reprorted
	 */

	var compileGrammar = function (grammar) {
		var errors = grammar._compile()
		if (errors.length > 0) {
			errors.unshift(grammar._rules[0].name + " compile failed:")	//; console.log('grammar=',grammar,'\nerrors=',errors)
			throw new Error(errors.join('\n\t'))
		}
	}	// compileGrammar(grammar)


	/*
	 *  5. Transform: metawordParse(content)
	 *  label and type defintions
	 */

	var metaword = new Grit(
		"metaword   := (blank / labeldef / typedef / uses / comment / undefined)* ",
		"labeldef	:~ (%word)\\s+=%labelspec 		:: label(_,1:label,2:tag,3:word,4:tag,5:block) ",
		"typedef    :~ (%word)\\s+:%block 			:: type(rules) ",
		"uses		:~ @import\\s+(%block)  			:: uses(_,urls) ",
		"blank		:~ [ \\t]* %nl					:: (_) => {return []} ",
		"comment	:~ // %line %nl					:: (function (_) {return []}) ",
		"undefined	:~ (%line) %nl					:: undefined(_,statement) ",
		"labelspec	:~ \\s*(?:(%tag) | (?:(%word) (?:%inset (%tag) | (%block))? ) )\\s*",
		"tag		:~ [<][^>]*[>]",
		"block		:~ %line %insetline* ",
		"insetline	:~ (?: %nl | (%inset %line)) ",
		"word		:~ \\S+ ",
		"line		:~ [^\\n\\r]* ",
		"inset		:~ [ \\t]+ ",
		"nl			:~ (?:\\r \\n? | \\n)"
	);

	metaword.label = function (definition, label, nakedTag, transformName, tagWithTransform, attrsWithTransform) {
		// label(_,1:label,2:tag,3:word,4:tag,5:block)
		// construct label definition: {transform:transformName, tag:tagString}
		// Note: transformName may be null
		//		 tagString may be empty (null?) and may either be full tag (<..>) or additional attributes
		var tagInfo = (nakedTag) ? nakedTag : (tagWithTransform || attrsWithTransform)
		tagInfo = ((tagInfo) ? tagInfo.trim().replace(/\s+/g, " ") : "")
		var typeInfo = (nakedTag) ? null : transformName
		// console.log(label,'=    transform:',typeInfo,"   tag:",tagInfo)
		context.addLabelDef(label, {transform: typeInfo, tag: tagInfo})
		return []
	} // metaword.label(definition, label, nakedTag, transformName, tagWithTransform, attrsWithTransform)

	metaword.type = function (rules) {
		var html = []
		try {
			var gram = new Grit(rules)		//; console.log(gram)
			compileGrammar(gram)
			context.addTransform(gram._rules[0].name, function (content) {
				return gram.parse(content)
			})
		} catch (err) {		// compile errors on new types
			html = markit('errorString', err.message)
		}
		return html
	} // metaword.type(rules)

	metaword.uses = function (_, urls) {
		var out = []
		var absurl, url, urlist = urls.trim().split(/\s+/)
		for (var u=0; u < urlist.length; u++) {
			url = urlist[u]
			absurl = composeURL(url)
			if (url.substr(-3) === ".js") {			// script: import it
				try {							// console.log("loadScript "+ absurl)
					loadScript(absurl)
				} catch (err) {	 // console.log("err.message=",err.message,"err.name=",err.name,"err=",err)
					out.push(markit('errorString',
						["Loading script '", absurl, "':\n\t", (err.message || err.name)].join('')))
					//ES6:   `Loading script '${absurl}' ${(err.message || err.name)}`))
				}
			} else {
				loadpath.unshift(directory(absurl))		// push new loadpath
				try {
					var content = fileContent(absurl)  // needs to be synchronous or frame sizes get mucked up
					if (url.substr(-4) === ".css") {	// stylesheet: create style element
						//i.e., this doesn't work: out.push(["<style scoped>@import url(", absurl, ");</style>"])
						out.push("<style scoped>", content, "</style>")
					} else {
						out.push(markit('metamark', content))	// process metatword
					}
				} catch (err) { // IO or markit Error
					out.push(markit('errorString', ["Reading '", absurl, "':\n\t", (err.message || err.name)].join('')))
				}
				loadpath.shift()						// pop loadpath
			}
		} // for
		return out
	} // metaword.uses(_, urls)

	metaword.undefined = function (_, statement) {
		return markit('errorString', ["Unrecognized metaword statement:\n\t", statement].join(''))
		//ES6:                               `Unrecognized metaword statement: ${statement}`)
	} // metaword.undefined(_, statement)

	compileGrammar(metaword)

	context.addTransform('metamark', function (content) {
		var html
		try {       // all exceptions turned into errorString's
			html = metaword.flatten(metaword.parse(content)).join('')
		} catch (err) {
			html = markit('errorString', err.message)
		}
		return html
	})

	/*********** Everything below this line is predefined markup and could be re-located. **********/
	/*********** See "Dependancy:" comments for API requirements.                         **********/


	/*
	 *  6. Utility function to translate labeled content: toHTMLstring(label, content, defaultTransform)
	 *      If no transform for label, use defaultTransform
	 *  returns html string or null(no transform found for label)
	 *  throws errors from markit(transform, content))
	 */

	var toHTMLstring = function (label, content, defaultTransform) {
		var htmlResult = null   // default for no label definition
		var definition = resolve(label)     //; console.log(label,'::',definition,'\n',content)
		if (definition) {
			if (definition.beginTag.substr(-2) === '/>') // closed tag implies no content
				htmlResult = definition.beginTag
			else {
				var transform = (definition.transform) ? definition.transform : defaultTransform	//; console.log("transform=",transform)
				var html = markit(transform, content)				//; console.log(html)
				htmlResult = [definition.beginTag,
					((html != null) ? html : markit('text', content)),
					definition.endTag].join('')
				//ES6:    `${definition.beginTag}${((html != null) ? html : content)}${definition.endTag}`
			}
		}
		return htmlResult
	} // toHTMLstring(label, content, defaultType)

	function resolve(label) {
		//**** Dependancy: context
		var labelDef = context.labelDef(label)					// {transform:typeInfo, tag:tagInfo}
		// console.log("label=",label,"labelDef=",labelDef)
		if (labelDef) {					// does label have definition record
			var transformName = labelDef.transform
			var bTag, eTag, transform
			if (context.transform(transformName)) {				// if a defined transform?
				bTag = labelDef.tag
				eTag = endTag(bTag)
				transform = transformName
			} else {											// possible alias
				if (context.labelDef(transformName)) {			// if another label?
					var baseRes = resolve(transformName)		//; console.log("baseRes=",baseRes)
					if (baseRes.beginTag) {
						if (labelDef.tag.charAt(0) === '<') {
							bTag = labelDef.tag					// new full tag overwrites old one
							eTag = endTag(bTag)
						} else if (labelDef.tag) {				// more attributes?
							bTag = [baseRes.beginTag.slice(0, -1), ' ', labelDef.tag, '>'].join('')
							eTag = baseRes.endTag
						} else {
							bTag = baseRes.beginTag
							eTag = baseRes.endTag
						}
					} else {
						bTag = labelDef.tag						// no base tag, use this one
						eTag = endTag(bTag)
					}
					transform = baseRes.transform				// alias uses type from base label
				} else {										// unknown type, just use tag
					bTag = labelDef.tag
					eTag = endTag(bTag)
					transform = null							// null type will resort to default type
				}
			}
			// console.log(label,'=>',bTag,transform,eTag)
			return {beginTag: bTag, endTag: eTag, transform: transform}
		} else {	// no label definition record
			return null
		}

		function endTag(beginTag) {
			return (beginTag && (beginTag.charAt(0) === '<')) ?
				((beginTag.lastIndexOf('/>') === (beginTag.length-2)) ? "" : ["</", beginTag.match(/^<\s*(\S+)[^>]*>$/)[1], ">"].join('')) :
				""
		} // endTag(beginTag)

	} // resolve(label)

	/*
	 *	Helper function which generates an array of label/tag pairs from label definitions with <a ..> tag
	 */
	/*
	var linkDefs = function (ctxt) {
		var ctx = (ctxt == null) ? context : ctxt
		var defs = (ctx.parent == null) ? [] : linkDefs(ctx.parent)
		var tag
		for (var label in ctx.index) {
			tag = ctx.labelDef(label).tag
			if (tag.startsWith('<a')) defs.push([label, tag])
		}
		return defs
	} // linkDefs()
	*/

	/*
	 *  7. Transform: blockParse(content)
	 *  create and translate block elements
	 */

	/*
	 1. If a line starts with a markup sigil then the first word is a block label.
	 1a. The content of a block label includes any number of indented lines and blank lines.
	 1b. The indented content text will have one tab, or 4 or less spaces, removed.
	 2. Lines inset by 1 tab, or 4 or more spaces, are inset code blocks.
	 3. A line of prose is any line that does not start with a markup sigil or a code inset.
	 3a. A paragraph is a group of one or more lines of prose that are not blank.
	 */


	var blocks = new Grit(
		"blocks  := chunk* ",
		"chunk   :~ (?: (%blank) | (%code) | (%block) | (%prose) ) :: chunk ",
		"blank   :~ (?: [ \\t]* %nl)+ ",
		"code    :~ (?: (?: \\t | [ ]{4}) %line %nl?)+ ",
		"prose   :~ (?: %line %nl?) ",
		"block   :~ (?:%head) (%content %nl?)  ", // head := label indent
		"head    :~ (\\S+) (?: \\t | [ ]{2,} | (?= [\n\r]+ (?: \\t | [ ]{1,4})) ) ",
		// "head    :~ (\\S+) [\n\r]* (?: \\t | [ ][ \\t]) [ \\t]* ",
		//"head    :~ ([~!@#%^&*_+=:`.?<>/-] [^ \\s\\[\\]()]* (?!\\S)) [ \\t]* ",
		"content :~ %line (?: %nl+ %inset %line)* ",
		"line    :~ [^\\n\\r]* ",
		"inset   :~ (?: [ \\t]+ ) ",
		"nl      :~ (?:\\r \\n? | \\n) "
	);

	blocks.chunk = function(_, blank, code, block, label, content, prose) {
		if (blank) return { blank:blank };
		if (prose) return { prose:prose };
		if (code) return { code:code };
		return {block:block, label:label, content:content};
	}

	compileGrammar(blocks); // verify grammar, or throw an error

	var foilParse = function(content) {
		var out = []
		if (!content) return '';

		context = context.push(blocks.parse(content)[0]);	// parse content and push new context for blks

		// Pass 1 : process metamark
		var bix = 0
		while (bix < context.blks.length) {
			var labelDef = resolve(context.blks[bix].label);
			if (labelDef && (labelDef.transform == 'metamark')) {
				// should be no uncaught exceptions from 'metamark' transform
				//var ma = getContent(context.blks.splice(bix, 1)[0]);
				//console.log("ma=",ma);
				//var mm = markit('metamark', ma);
				//console.log("mm=",mm)
				out.push(markit('metamark', getContent(context.blks.splice(bix, 1)[0])))
			} else
				bix++                                       // skip content block
		}

		// Pass 2 : process remaining blocks into output
		while (context.blks.length>0) {
			var blk = context.blks[0];

			if (blk.label) try {
				var html = toHTMLstring(blk.label, getContent(blk), 'myword')
				if (html) {
					out.push(html)
				} else { // undefined label...
					// out.push("<dl><dt><mark>"+blk.label.replace(/</g,'&lt;')+"</mark></dt><dd><pre>"+
					// 	blk.content.replace(/</g,'&lt;')+"</pre></dd></dl>")
					out.push("<pre><mark>"+blk.label.replace(/</g,'&lt;').trim()+"</mark> "+
						blk.content.replace(/</g,'&lt;')+"</pre>")
				}
			} catch (err) {
				out.push(markit('errorString', err.message))
			}

			if (blk.code) {
				out.push("<pre><code>", blk.code.replace(/</g,'&lt;'), "</code></pre>");
			}

			if (blk.prose) { // line of prose...
				var proseContent = blk.prose;
				context.blks.shift();   // consume block
				while (context.blks.length>0) { // collect lines in para..
					blk = context.blks[0]   // examine next block
					if (blk.prose) {
						proseContent += blk.prose;
						context.blks.shift();   // consume block
					} else {
						break
					}
				}
				try {
					out.push("<p data-type='prose'>", markit('prose', proseContent), "</p>")
				} catch (err) {
					out.push(markit('errorString', err.message))
				}
				continue;
			}
			context.blks.shift();   // consume block
		} // while
		context = context.pop();						// restore previous context

		return blocks.flatten(out).join('');			// return single string from meta content and joined array
	} // blockParse(content)


// shift content left into the margin...

	var getContent = function (blk) {
		if (!blk.content) return "";
		var min = 4; // remove 4 spaces or one tab ...
		var content = blk.content.replace(/(\n|\r\n?)(([ ]{1,4})|\t)/g, function(_,nl,_,spaces) {
			if (!spaces) return '\n'; // remove tab
			var len = spaces.length;
			if (len > min) { return '\n'+'    '.slice(0,len-min); } // remove less spaces
			if (len < min) min = len; // new margin inset
			return '\n'; // remove all min spaces
		});
		//console.log("c="+content.trim());
		return content.trim();
	} // getContent(blk)

// group of same label blocks...

	var groupBlocks = function() { // content of next in group ...
		var currentblk = context.blks[0]
		var blk = context.blks[1]                      // look ahead
		while (blk && blk.blank) {                     // remove blanks
			context.blks.splice(1,1);
			blk = context.blks[1];
		}
		if (blk) {
			if (blk.label == currentblk.label) {
				context.blks.shift()                   // remove current block, matching block now first
				return getContent(blk)                 // return block content
			}
		}
		return null
	} // groupBlocks()

// define labels and types for blocks
	context.addLabelDef('&', {transform:'metamark', tag:""})
	context.addLabelDef('@include', {transform:'import', tag:""})

	context.addTransform('myword', foilParse)		      // transform for foil,  **** Dependancy: context, compileGrammar()

	context.addTransform('import', function(content) {       // transform for including content in external resources
		//**** Dependancy: I/O utilities, context via resolve
		var out = []                        //; console.log('@import',content)
		var absurl, url, urlist = content.trim().split(/\s+/)
		for (var u=0; u < urlist.length; u++) {
			url = urlist[u]
			absurl = composeURL(url)	//; console.log('@import ',absurl)
			loadpath.unshift(directory(absurl))			// push new loadpath
			try {
				var fcontent = fileContent(absurl)
				// if there's a label defined for the URL suffix, use its transform, else use 'myword' transform
				var html = toHTMLstring(url.substring(url.lastIndexOf('.')), fcontent, 'myword')
				if (html)
					out.push(html)
				else
					out.push(markit('myword', fcontent))  // apply 'myword' if no label defined for suffix
			} catch (err) { // IO or translateData Error
				out.push(markit('errorString', ["Reading '", absurl, "':\n\t", (err.message || err.name)].join('')))
			}
			loadpath.shift()							// pop loadpath
		}
		return out.join('')
	})

	context.addTransform('list', function(content) {	// transform for list grouping:
		//**** Dependancy: context
		var out = [];
		while (content) {       //; console.log("grouping:",content)
			try {
				out.push("<li>", markit('myword', content), "</li>");
			} catch (err) {
				out.push(markit('errorString', err.message))
			}
			content = groupBlocks();
		}
		return out.join('');

	})

	context.addTransform('terms', function(content) {	// transform for list grouping:
		//**** Dependancy: context
		var out = [];
		while (content) {       //; console.log("grouping:",content)
			try {
				var termx = content.match(/\s*([^\n\r]+)([\s\S]*)/);
				var term = markit('text', termx[1]);
				out.push("<dt id='"+term+"'>", term, "</dt>");
				out.push("<dd>", markit('myword', termx[2]), "</dd>");
			} catch (err) {
				out.push(markit('errorString', err.message))
			}
			content = groupBlocks();
		}
		return out.join('');

	})



	/*
	 *  8. Transform: proseParse(content)
	 *  create and translate inline elements
	 */

	var sigilProse = new Grit(
		"prose       := (element / text)*                     :: (function(content) {return this.flatten(content).join('')}) ",
		"element     := label content     	                  :: element ",
		"text        :~ [\\s\\S][^~!@#%^&*_+=:`.?<>/-]*       :: (function(text) {return text.replace(/</g,'&lt;').replace(/\\x5C/g, '<br>')}) ",
		"label       :~ [~!@#%^&*_+=:`.?<>/-]+ [A-Za-z0-9]*   :: (function(label) {return label}) ",
		"content     := (open_p content_p close_p) / (open_b content_b close_b) :: (function(content) {return this.flatten(content[1]).join('')}) ",
		"content_p   := (paren / char_p)* ",
		"paren       := open_p content_p close_p ",
		"content_b   := (brack / char_b)* ",
		"brack       := open_b content_b close_b ",
		"open_p      :~ [\\(] ",
		"close_p     :~ [\\)] ",
		"char_p      :~ [^)] ",
		"open_b      :~ [\\[] ",
		"close_b     :~ [\\]] ",
		"char_b      :~ [^\\]] ");

	sigilProse.element = function(label, content) {
		var html;
		try {
			html = markit.withLabel(label, content, "prose")	// use internal toHTMLstring() if withLabel() removed from API
		} catch (err) {
			html = markit('errorString', err.message)
		}
		if (!html) {
			html = ["<mark>", markit('text', label), "[</mark>", markit("text", content), "<mark>]</mark>"];
		}
		return html;
	}

	compileGrammar(sigilProse); // verify grammar, or throw an error

	var proseParse = function(content) {
		return sigilProse.parse(content);
	} // proseParse(content)

	context.addTransform('prose', proseParse)       // transform for prose,  **** Dependancy: context, compileGrammar()


	/*
	 *  9. export.....
	 */
	//console.log(this)
	markit.withLabel = toHTMLstring
	//markit.linkDefs = linkDefs
	//return markit;   // global translator markit(transformName, content)
	if (typeof module !== 'undefined' && typeof exports === 'object') {
		module.exports = markit;
	} else if (typeof define === 'function' && define.amd) {
		define(function () {
			return markit;
		});
	} else
		this.markit = markit;   // global translator markit(transformName, content)
//}();
}).call(function() {
	return this || (typeof window !== 'undefined' ? window : global);
}());
