@import  mermaid.css

@javascript
	// <my-mermaid> table of contents
	( () => {

		class MyMermaid extends HTMLElement {
			constructor() {
				super();
			} // constructor()

			connectedCallback() {
				var container = this
				renderMermaid()

				function renderMermaid() {
					// may need to wait until 'mermaidAPI' is available.
					if (typeof mermaidAPI !== 'undefined') {
						//console.log('mermaidAPI ready.')
						if (!container.querySelector('svg'))  // not already rendered?
							mermaidAPI.render('mermaid' + new Date().getTime(), container.textContent, insertSvg)
					} else {
						//console.log('Waiting for mermaidAPI.')
						setTimeout(renderMermaid,250)
					}
				} // renderMermaid()

				function insertSvg(svgCode) {
					container.innerHTML = svgCode
					container.style.visibility = 'visible'
					container.querySelector('svg').style.height = 'inherit'
				} // insertSvg(svgCode)

			} // connectedCallback()
		} // MyMermaid

		if (!customElements.get('my-mermaid'))
		customElements.define('my-mermaid', MyMermaid)

	})()

@doc
	Some examples (may appear small in demo):
	demo
		.require
			mermaidAPI.min.js

		mgraf>
			graph TD;
				A-->B;
				A-->C;
				B-->D;
				C-->D;
		mgraf>
			gantt
				title A Gantt Diagram

				section Section
				A task           :a1, 2014-01-01, 30d
				Another task     :after a1  , 20d
				section Another
				Task in sec      :2014-01-12  , 12d
				anther task      : 24d


		.mmk
			require :: (urllist) => urllist.trim().split(/\s+/)
										.map((url) => `<script src='${url.trim()}'></script>`)
										.join('')
			@import mermaid.mmk
			mgraf> .. <- <my-mermaid style='visibility:hidden'> text

