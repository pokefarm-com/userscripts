/*
Author: NE0NYAN
Adds the Original Trainer (OT) to a Pokémon's Summary Page
If you find errors in the code, you can use github to report them OR you can use the forum thread on PFQ in the guides category dedicated to this script. [https://pfq.link/~-B06]
*/
(function () {
    "use strict";
    // Check that we are on a Summary page
    if (!/^\/summary/.test(location.pathname)) return;

    // Getting the OT
    const timelineElement = document.getElementById('timeline');
    if (!timelineElement) return;
    const timelineEntries = [...timelineElement.children].reverse(); // oldest first

    /* How to find the OT of a Pokemon:
    - The first time they are traded, the SENDER is the OT.
    - If they have not been traded, the HATCHER is the OT.
    - If they are in the Shelter, they have NO OT.
    */
    const otLink = timelineEntries.find(entry=>{
        const type = entry.querySelector("use")?.getAttribute("xlink:href");
        return type === "#svg_icon_trade";
    })?.querySelector("a") || (() => {
        // no trade found
        const elem = document.createElement('i');
        elem.textContent = 'Not traded yet';
        return elem;
    })();

    // Get any icons attached to the OT's link
    const otIcons = (node => {
        const icons = [];
        while (node && node.previousSibling?.nodeName === 'IMG') {
            node = node.previousSibling;
            icons.unshift(node.cloneNode(true));
        }
        return icons;
    })(otLink);

    // Create elements to render the result
    const p = document.createElement('p');
    const b = document.createElement('b');
    b.textContent = 'Original Trainer:';
    p.append(b, ' ', ...otIcons, otLink.cloneNode(true));

    // Insert OT into the box
    const insertLocation = document.getElementById('pkmnspecdata');
    insertLocation.insertAdjacentElement("afterbegin", p);
})();
