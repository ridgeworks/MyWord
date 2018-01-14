@doc .myw
	####  Package `box.mmk`
	The `box` type provides support for simple box and arrow diagrams using Unicode box drawing characters. The notation consists of short sequences of ASII characters representing the various corners and sides of a box, intersections to support nested boxes, and vertical and horizontal arrows, as follows:
	.tsv
		To Represent a:			Use		Notes
		Vertical line			`|`		also a verical bar but slightly higher
		Horizontal line			`-`		also a hyphen/minus sign but slightly wider
		Upper left corner		`.-`	 
		Tee						`-.-`	 
		Upper right corner		`-.`	 
		Left tee				`|-`	 
		Intersection			`-|-`	 
		Right tee				`-|`	 
		Lower left corner		`'-`	 
		Inverted tee			`-'-`	 
		Lower right corner		`-'`	 
		Left arrowhead			`<-`	 
		Right arrowhead			`->`	 
		Up arrowhead			`^`		must be preceeded by a space or tab and succeeded by space, tab, or EOL
		Down arrowhead			`v`		same constraints as Up arrowhead

	The box diagram is wrapped in `<pre class=my_box>` so users can apply their own styles; the default is:
	 `    pre.my_box {font-size:smaller; font-family: Menlo, Consolas, Courier New, monospace}`

	The rendered output is heavily dependent on the monspaced font used to draw the Unicode box characters and can vary between platforms. Cross-platform testing is required to achieve the best results.
	Examples:
	demo
		.box
			Corners: .-  -.-  -.   |-  -|-  -|   '-  -'-  -'

			Horizontal Arrows: Left: <-   Right: ->   Double: <->

			Vertical Arrows:   Up:    ^   Down:       UpDown:   ^
			                          |           |             |
			                                      v             v
			Simple Box:
			.-------.
			| A Box |
			'-------'

			Box with four quadrants...:
			.----.----.
			| NW | NE |
			|----|----|
			| SW | SE |
			'----'----'

			Minimal boxes:
			.-. .-.-. .-.-.
			'-' |-|-| |1|2|
			    '-'-' |-|-|
			          |3|4|
			          '-'-'

			Forks/Joins:          |     |   |     --.         .--
			                    .-'-.   '-.-'       |--     --|
			                    |   |     |       --'         '--

@css
	pre.my_box {line-height:1; font-size:smaller; font-family: Menlo, Consolas, Courier New, monospace}

.box ..    <- box
box        := bxline*                :: (blines) =>
	                           `<pre class=my_box>${this.flatten(blines).join('')}</pre>`
	bxline := (bxitem / txt)* nl?
	bxitem := dblFlk / lftFlk / rgtFlk / vline / hline

	dblFlk := tee / cross / invtee / uhead / dhead
	lftFlk := urcrnr / vrcrnr / drcrnr / rhead
	rgtFlk := ulcrnr / vlcrnr / dlcrnr / lhead

	tee    :~ %horz %dncrnr %htest   :: (_) => '&boxh;&boxhd;'
	cross  :~ %horz %vert %htest     :: (_) => '&boxh;&boxvh;'
	invtee :~ %horz %upcrnr %htest   :: (_) => '&boxh;&boxhu;'
	ulcrnr :~ %dncrnr %htest         :: (_) => '&boxdr;'
	urcrnr :~ %horz %dncrnr          :: (_) => '&boxh;&boxdl;'
	vlcrnr :~ %vert %htest           :: (_) => '&boxvr;'
	vrcrnr :~ %horz %vert            :: (_) => '&boxh;&boxvl;'
	dlcrnr :~ %upcrnr %htest         :: (_) => '&boxur;'
	drcrnr :~ %horz %upcrnr          :: (_) => '&boxh;&boxul;'
	lhead  :~ %left %htest           :: (_) => '&#9664;'
	rhead  :~ %horz %right           :: (_) => '&boxh;&#9654;'
	uhead  :~ (%prehd) %up %posthd   :: (_, pre) => [pre, '&#9650;']
	dhead  :~ (%prehd) %down %posthd :: (_, pre) => [pre, '&#9660;']

	prehd  :~ [ \t]
	posthd :~ (?=\s)
	htest  :~ (?=%horz)

	vline  :~ %vert                  :: (_) => '&boxv;'
	hline  :~ %horz                  :: (_) => '&boxh;'

	dncrnr :~ [.]
	upcrnr :~ '
	left   :~ <
	right  :~ >
	up     :~ \^
	down   :~ v
	vert   :~ [|]
	horz   :~ -
	txt    :~ [\t\x20-\uffff]
	nl     :~ (?: \n | \r\n?)
