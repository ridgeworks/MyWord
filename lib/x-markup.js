// -- x-markup: Browser interface to markit framework ---------------------------

/*	The MIT License (MIT)
 *
 *	Copyright (c) 2016 Rick Workman
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

// mark this script for the load handler

if (location.pathname.substr(-4) !== '.myw') { // if source not myword content
  (document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script')	// for old browsers not supporting currentScript
    return scripts[ scripts.length - 1 ]
  })()).id = 'x-markitApp'
}

// add load event handler
window.addEventListener('load', function (ev) {  // Note: doesn't overwrite other handlers like "onload = function(ev) {..} "
  var globals = window    // some semblance of environment independence
  var target = ev.currentTarget.document       // ; console.log("onload:",target,"\n",this)
  var mywordContent = (location.pathname.substr(-4) === '.myw') // true if document is myword source
  var appScriptURL = (mywordContent) ?                      // if myword source, assume chrome extension
      chrome.runtime.getURL("lib/x-markup.js") :            // for Chrome and Firefox extensions, unfortunate hard coded name
      target.querySelector('script#x-markitApp').getAttribute('src')
  var appName = (appScriptURL.lastIndexOf('/') === -1) ? appScriptURL : appScriptURL.substring(appScriptURL.lastIndexOf('/') + 1)
  var versionString = appName + ' Version: 0.2ß7'
  var errorLabel = ['*** ', appName, ' error: '].join('')
  var mimeType = 'text/x-markup.' 		// in practice: text/x-markup.transformName
  var workerName = 'markit.js'
  var lingoName = 'x-markup.mmk'
  var MarkIt = null  // markit Worker - continueInit will initialize it
  var initQueue = [] // holds window messages until init complete

  var errorMessage = function (msgComponents) {
    return errorLabel + msgComponents.join('')
  } // errorMessage(msgComponents)

  // handle load event
  console.log(navigator.appCodeName, navigator.appVersion)
  console.log(versionString)

  globals.addEventListener('message', function (event) {  // event handler for window messages
    if (event.source === window) try {   // only local messages supported
      if (Array.isArray(initQueue)) {	// still initializing?
        initQueue.push(event.data)
      } else {
        if (event.data.transform) {
          post(event.data.transform, target.body.querySelector(event.data.selector)) // post request to markit
        }
      }
    } catch (err) {
      console.error(errorMessage([ 'handling message ', JSON.stringify(event.data), ' error:', err ]))
    }
  })

  startWorker(appScriptURL.replace(appName, workerName), continueInit)   // make Web Worker object which does all the work

  function continueInit(worker) {
    MarkIt = worker

    var noArrow = false
    try { eval('(() => true)') } catch (err) { noArrow = true }  // just a test, not used
    console.log([ 'Arrow functions are ', noArrow ? 'NOT ' : '', 'supported in this browser.' ].join(''))

    var lingoURL = appScriptURL.replace(appName, lingoName)
    var request = new globals.XMLHttpRequest()
    request.open('GET', lingoURL, true)
    request.onload = function () {
      var status = 0
      status = ((status === 0) ? this.status : status)   // ; console.log("status=",status)
      if ((status === 200 || status === 0)) {
        MarkIt.queue.push({ document: document, elemID: null })
        try {
          MarkIt.postMessage([ lingoURL, 'metamark', this.responseText, 0 ])  // ; console.log("posting ",type," ",tElement," to ",document)
        } catch (err) {
          MarkIt.queue.shift()       	// remove queue item
          // log message to console, no x-markup.mmk to use, so ignore
          console.error(errorMessage([ err.message, ' posting metamark content to ', document ]))
        }
      } else {
        console.log('Error reading', lingoURL, ' code=', status)
      }
      processScripts(mywordContent)
    }
    request.onerror = function () {
      console.log('Error reading', lingoURL, ' code= 404')
      processScripts()
    }
    request.send()	// ; console.log(request.status,url,"["+request.responseText.length+"]")
  } // continueInit(worker)


  function startWorker (workerURL, callbackOnComplete) {	//  init Worker object and return it
    try {
      callbackOnComplete(initWorker(new globals.Worker(workerURL)))
    } catch (err) {
      if (err.code === 18/*DOMException.SECURITY_ERR*/) { // Assume extension, workaround using AJAX and blobs
        var request = new XMLHttpRequest();
        request.responseType = 'text';  // RWW was 'blob';
        request.onload = function() {
          // http://stackoverflow.com/a/10372280/938089
          // RWW insert defintion for _extensionHref in source text
          var extWorkerURL = URL.createObjectURL(new Blob(['_extensionHref="',workerURL, '";\n', request.response], {type: 'text/javascript'}))
          callbackOnComplete(initWorker(new globals.Worker(extWorkerURL)))
        };
        request.open('GET', workerURL);
        request.send();
      } else {
        console.error(errorMessage([ err.message, ' intitializing Worker.' ]))
        throw(err)
      }
    }

    function initWorker (worker) {
      worker.onmessage = function (content) {
        updateDOM(content.data)
      }
      worker.onerror = function (err) { // if this happens, it's a bug (uncaught exception in Worker?)
        var eMsg = errorMessage([ 'Worker ', err.message ])
        var element = null
        if (worker.queue.length > 0) {
          element = updateDOM(
            [ '<pre><mark style="color:blue"><br>', eMsg, '<br></mark></pre>' ].join(''))
          // ES6: `<mark style='color:blue'>${eMsg}</mark><br>`
        }
        console.error(eMsg, (element) ? ' translating ' + element : '')
      }

      worker.queue = [] // queue to keep "job" details for async post-processing
      worker.nxtID = 1
      /* replaced by window messages
       window.x_markup.transformElement = function (transform, element) { // Init global API for custom extensions
       post(transform, element)
       }*/
      return worker
    } // initWorker (worker)
  } // initWorker()

  function processScripts (mywordContent) {
    if (target) {
      console.log('Document URL='+location.href)
      if (mywordContent) {  // .myw file - use contents of <pre> as myword source
        var divElement = document.createElement('div')
        var sourceElement = target.body.querySelector('pre')
        divElement.textContent = sourceElement.textContent
        document.body.replaceChild(divElement, sourceElement)
        post('myword', divElement)
      } else {
        var noContentPosted = true
        if (location.search) { // check if query parameter has src='... .myw'
          var srcURL = location.search.match(/\?.*src=([^&]+)/) //find a src key in query string and extract URL
          if (srcURL) {
            srcURL = srcURL[1]
            if (srcURL.substr(-4) !== '.myw') srcURL += '.myw'
            var mydoc = document.createElement('div')
            mydoc.textContent = srcURL
            document.body.appendChild(mydoc)
            post('include', mydoc)
            noContentPosted = false
          }
        }
        // scan for script elements to transform
        var dmScripts = target.body.querySelectorAll([ "script[type^='", mimeType, "']" ].join(''))
        var typeValue
        for (var s = 0; s < dmScripts.length; s++) {
          typeValue = dmScripts[ s ].getAttribute('type')
          post(typeValue.substring(mimeType.length), dmScripts[ s ])
          noContentPosted = false
        } // for
        if (noContentPosted && (target.body.childElementCount === 0))  // nothing in <body> , stick in an error message
          target.body.innerHTML = '<pre><mark style="color:blue">No MyWord content found for this page!</mark></pre>'
      }
      var msg; while (msg = initQueue.shift())  // process pending window message queue
        post(msg.transform, target.body.querySelector(msg.selector))
      initQueue = null	// subsequent window messages go directly to post()
    }
  } // processScripts()

  function post (type, element) {   // post message to MarkIt with structured text object
    if (type) {
      element.style.visibility = 'hidden'				   // hide element while rewriting it
      var source = element.textContent
      var tElement, srcURL
      if (element.tagName.toLowerCase() === 'script') {  // if a <script> element, convert it to empty <div>
        srcURL = element.getAttribute('src')
        if (srcURL) {
          element.removeAttribute('src')
          if (srcURL === '?') {
            var docURL = document.documentURI
            srcURL = docURL.substring(0, docURL.lastIndexOf('.')) + '.myw'
            if (document.title.length === 0) {
              document.title = srcURL.substring(srcURL.lastIndexOf('/') + 1)
            }
          }
  /*var request = new globals.XMLHttpRequest()  //TODO can this be done simpler with @include  srcURL
  request.open('GET', srcURL, true)
  request.onload = function () {
    var status = 0
    status = ((status === 0) ? this.status : status)   // ; console.log("status=",status)
    if ((status === 200 || status === 0)) {
      element.textContent = this.responseText
      post(type, element)	// re-post with loaded content
    } else {
      element.parentNode.replaceChild(errElement(srcURL, status), element)
    }
  }
  request.onerror = function () {
    element.parentNode.replaceChild(errElement(srcURL, 404), element)
  }
  request.send()   // ; console.log(request.status,url,"["+request.responseText.length+"]")
  return*/
          type = 'include'    // set transform to include, file content type determined from file suffix in URL
          source = srcURL     // set content to source URL
        }
        tElement = document.createElement('div')
        var attrs = element.attributes
        for (var a = 0; a < attrs.length; a++) {
          tElement.setAttribute(attrs[ a ].name, attrs[ a ].value)
        }
        element.parentNode.replaceChild(tElement, element)
      } else {
        tElement = element
      }
      if (!tElement.getAttribute('id')) {   // if element doesn't have an ID, manufacture one
        tElement.setAttribute('id', 'FWmsg' + MarkIt.nxtID++)
      }
      MarkIt.queue.push({document: document, elemID: tElement.getAttribute('id')})
      try {
        // console.log('contextID(element)=',contextID(element))
        // document base is just origin and pathname, any fragment or query is dropped
        var origin = (document.location.origin === 'null') ? 'file://' : document.location.origin // for Firefox 'null' origin value
        MarkIt.postMessage([origin + document.location.pathname, type, source, contextID(element)])  // ; console.log("posting ",type," ",tElement," to ",document)
      } catch (err) {
        MarkIt.queue.shift()       	// remove queue item
        element.style.visibility = 'visible'	// make element visible again
        // leave element alone, error message in console
        console.error(errorMessage([err.message, ' posting ', type, ' content to ', document]))
      }
    }

    function contextID(elem) {    // look up a contextID value in the lement or one of its ancestors.
      if (elem === null) return 0
      var id = elem.getAttribute('data-context')
      return (id) ? parseInt(id) :
          ((elem.tagName.toLowerCase() === 'body') ? 0 : contextID(elem.parentNode))
    }

    function errElement (url, status) {
      var preElement = document.createElement('pre')
      preElement.innerHTML = ['<mark style="color:blue"><br/>Error reading "', url, '": status=', status, '<br></mark>'].join('')
      return preElement
    } // errElement(url, status)
  } // post(type,element)

  function updateDOM (content) {	// update DOM with Worker result, returns modified element
    var item = MarkIt.queue.shift()    							// get work item
    // and element. Note special case - elemID == null, means loading x-markup.mmk
    var element = (item.elemID) ? document.getElementById(item.elemID) : document.body
    // console.log("receiving "+((content)?"content":"null")+" for ",element)
    //if (content && (content.length > 0)) {
    if (typeof content === 'string') { // TODO distinguish between null and ''
      try {
        if (element.tagName.toLowerCase() === 'body') {	// reply from x-markup.mmk translation
          var temp = document.createElement('div')		// will be garbage collected
          temp.innerHTML = content
          var tempChildren = temp.children              //Note: live collection
          var bodyFirst = element.firstChild
          while (tempChildren.length > 0)
            element.insertBefore(tempChildren[0], bodyFirst)
          return element
        } else {
          element.innerHTML = content
          element.style.visibility = 'visible'                 	// have to render before adjusting size
          if (document.defaultView.frameElement) adjustSize(document.defaultView.frameElement)
          //var frames = element.querySelectorAll('iframe')
          //for (var f = 0; f < frames.length; f++)  adjustSize(frames[f])
          var scripts = element.getElementsByTagName('script')	// have to clone & replace scripts to get them executed
          var script, newscript
          for (var s = 0; s < scripts.length; s++) {
            script = scripts[s]
            newscript = document.createElement('script')
            newscript.innerHTML = script.innerHTML
            for (var ai = 0; ai < script.attributes.length; ai++) {
              newscript.setAttribute(script.attributes[ai].name, script.attributes[ai].value)
            }
            script.parentElement.replaceChild(newscript, script)
          }
        }
        dispatchUpdate(document, element)                   	// invoke listeners for update
      } catch (err) {
        element.style.visibility = 'visible'		// something failed, just make element visible again
        console.error(errorMessage([err.message, ' updating ', element]))
      }
    } else element.style.visibility = 'visible'            		// no new content, make it visible
    return element
  } // updateDOM(content)

  function adjustSize (iframe) {   // adjust size of iframe element after DOM modified
    var document = iframe.contentDocument.documentElement
    // console.log("New frame size",document.scrollHeight," : ",iframe)
    // Wait for images - sometimes necessary, particularly on Chrome
    var images = document.getElementsByTagName('img')
    // ES6: for (var img of images) {
    for (var i = 0; i < images.length; i++) {
      var img = images[i]      // ; console.log("Checking ", img, img.complete)
      if (!img.complete) {     // ; console.log("Waiting for ",img)
        img.onload = function () {
          this.onload = null
          adjustSize(iframe)
        }
        img.onerror = function () {
          this.onerror = null
          adjustSize(iframe)
        }
        return
      }
    }
    // Some browsers require height setting to be deferred (render complete?)
    // Messages would be faster than setTimeout(fn,0) but effieciency not a big issue for this
    // Other alternatives: setImmediate(fn) (not standard) or requestAnimationFrame(fn) (normal usage?)
    setTimeout(function () {
      iframe.style.height = (document.scrollHeight) + 'px'
      //console.log("New frame style.height",iframe.style.height," : ",iframe)
      var parentFrame = iframe.ownerDocument.defaultView.frameElement
      if (parentFrame) adjustSize(parentFrame)
    }, 0)
  } // adjustSize(iframe)

  /* ******************  Start of "feature" listeners  ********************* */

  var listeners = [] // listener events dispatched to listeners whenever MarkIt returns new HTML content

  var addListener = function (listener) {
    if (typeof listener === 'function') {
      for (var l = 0; l < listeners.length; l++) {
        if (listeners[ l ] === listener) return	// listener already registered, return
      }
      listeners.push(listener)					// new listener, add it
    } else console.error(errorMessage(['Invalid listener: ', listener]))
  } // addListener(listener)

  var removeListener = function (listener) {
    for (var l = 0; l < listeners.length; l++) {
      if (listeners[l] === listener) {
        listeners.splice(l, 1)
        break
      }
    }
  } // removeListener(listener)

  var dispatchUpdate = function (document, element) {		// called from updateDOM()
    for (var l = 0; l < listeners.length; l++) listeners[l].call(null, document, element)
  } // dispatchUpdate(document, element)

  
  // Math plug-in : use MathJax if loaded
  function hasMathML () {	// returns true if platform has native MathML support
    var hasMML = false
    if (document.createElement) {
      var div = document.createElement('div')
      div.style.position = 'absolute'
      div.style.top = div.style.left = 0
      div.style.visibility = 'hidden'
      div.style.width = div.style.height = 'auto'
      div.style.fontFamily = 'serif'
      div.style.lineheight = 'normal'
      div.innerHTML = '<math><mfrac><mi>xx</mi><mi>yy</mi></mfrac></math>'
      document.body.appendChild(div)
      hasMML = (div.offsetHeight > div.offsetWidth) // proper fraction rendering has height > width
      document.body.removeChild(div)
    }
    return hasMML
  }

  var noMML = !hasMathML()		// not used in this version
  console.log(['MML is ', noMML ? 'NOT ' : '', 'supported in this browser.'].join(''))
  if (/* noMML && */ (typeof globals.MathJax !== 'undefined')) { // if (MathJax) add it feature listeners
    addListener(function (document, element) {
      globals.MathJax.Hub.Queue([ 'Typeset', globals.MathJax.Hub, element ])
    })
  }

  /* Polyfill for scoped styles - plagerized from (https://github.com/thomaspark/scoper)

   Copyright (c) 2015 Thomas Park

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE.
   */
  function scopeIt (document, element) {
    if (!(MarkIt.scopeID)) MarkIt.scopeID = 0
    var styles = element.querySelectorAll('style[scoped]')
    if (styles.length > 0) {
      var head = document.head || document.getElementsByTagName('head')[0]
      var newstyle = document.createElement('style')
      var csses = ''
      for (var i = 0; i < styles.length; i++) {
        var style = styles[i]
        var css = style.innerHTML
        if (css) {
          var parent = style.parentNode
          // don't process any immediate decendants of body element (shouldn't wrap body element)
          if (parent.tagName.toLowerCase() !== 'body') {
            var id = 'scoper-' + (MarkIt.scopeID++)
            var prefix = '#' + id
            var wrapper = document.createElement('span')
            wrapper.id = id
            var grandparent = parent.parentNode
            grandparent.replaceChild(wrapper, parent)
            wrapper.appendChild(parent)
            style.parentNode.removeChild(style)
            csses = csses + scoper(css, prefix)
          }
        }
      }
      if (newstyle.styleSheet) {
        newstyle.styleSheet.cssText = csses
      } else {
        newstyle.appendChild(document.createTextNode(csses))
      }
      head.appendChild(newstyle)
    }

    function scoper (css, prefix) {
      var re = new RegExp('([^\\r\\n,{}]+)(,(?=[^}]*{)|\\s*{)', 'g')   // escaped '\' - issue for scoper?
      css = css.replace(re, function (g0, g1, g2) {
        if (g1.match(/^\s*(@media|@keyframes|to|from)/)) {
          return g1 + g2
        }
        g1 = g1.replace(/^(\s*)/, '$1' + prefix + ' ')
        return g1 + g2
      })
      return css
    } // scoper(css, prefix)
  } // scopeIt(document, element)

  var noscoped = !('scoped' in document.createElement('style'))
  console.log(['Scoped styles are ', noscoped ? 'NOT ' : '', 'supported in this browser.'].join(''))
  if (noscoped) addListener(scopeIt)		// add scopeIt to feature listeners

  
  // Document feature to mark local links (href=#...) which are not defined
  function markBadLocalLinks (document, element) {
	  var localRefElements = element.querySelectorAll('a[href^="#"]')	// find all local refs in element
	  for (var el = 0; el < localRefElements.length; el++) {
		  var localRef = localRefElements[el]
		  // drop the # and check link defined
		  if (! document.getElementById(localRef.getAttribute('href').substring(1))) {
			  // bad link: wrap ref element in <mark class=badlink>
			  var marked = document.createElement('mark')
			  marked.className = 'badlink'
			  localRef.parentNode.insertBefore(marked,localRef)
			  marked.appendChild(localRef)		// moves localRef inside marked
        	  console.error(errorMessage(['Undefined local link in ', localRef.outerHTML]))
		  }
	  } // for
  } // markBadLocalLinks (document, element)
	
  addListener(markBadLocalLinks)
	

  } // event handler
)
