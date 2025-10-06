/*
  Delta Previewer by Corviknight [https://pfq.link/@Kp]
  Adds an option to the Pokemon menu to preview a different Delta type or remove Delta type.
  The script will now load the on-site image *if* it exists yet, otherwise, it will fallback to a CSS mockup.
  Thank you to Mirzam for their CSS implementation, found here: https://pfq.link/~-BQw
  This was referenced for the CSS portion.
*/
(function () {
  'use strict';
  const allowedPaths = [
    /^\/summary\/[^/]+$/,
    /^\/party$/
  ];

  if (!allowedPaths.some(pattern => pattern.test(location.pathname))) return;
  const checkImageExists = async function (url, target, base, type) {
    // for fetching corresponding hex color from type
    // grabbed from Mirzam's css and converted from rgb to hex (thank you!)
    const typeHex = {
      // add fallback for none type
      "none": "#A8A878",
      "normal": "#A8A878",
      "fire": "#F08030",
      "water": "#6890F0",
      "electric": "#F8D030",
      "grass": "#78C850",
      "ice": "#98D8D8",
      "fighting": "#C03028",
      "poison": "#A040A0",
      "ground": "#E0C068",
      "flying": "#A890F0",
      "psychic": "#F85888",
      "bug": "#A8B820",
      "rock": "#B8A038",
      "ghost": "#705898",
      "dragon": "#7038F8",
      "dark": "#705848",
      "steel": "#B8B8D0",
      "fairy": "#FF65D5"
    };
    // split on " character to separate out url("url...") into just url
    // due to css formatting
    let res = await fetch(url.split("\"")[1]);
    if (res.status != 200) {
      // if response status is not OK, then we fallback to a CSS preview w/ drop-shadow
      // start with our base image without delta aura
      target.style.backgroundImage = base;
      // drop shadow values also grabbed from Mirzam
      target.style.filter = `
        drop-shadow(0px 1px 0px ${typeHex[type]})
        drop-shadow(-1px 0px 0px ${typeHex[type]})
        drop-shadow(1px 0px 0px ${typeHex[type]})
        drop-shadow(0px 0px 1px ${typeHex[type]})
        drop-shadow(0px -2px 1px ${typeHex[type]})
      `;
      document.querySelector("div.changedelta").remove();
      document.querySelector("#core").classList.remove('scrolllock');
    }
    else {
      // if status = 200, then the image exists
      // so just apply that and remove any pre-existing drop shadow
      target.style.backgroundImage = url;
      target.style.filter = "";
      document.querySelector("div.changedelta").remove();
      document.querySelector("#core").classList.remove('scrolllock');
    }
  };

  const optionHtml = `
    <hr>
    <label id="changeDelta">Preview Delta Type</label>
  `;
  const newHtml = document.createElement("div");

  // we grab these elements because i want to put our new html right after them
  const menus = document.querySelectorAll(`[data-menu="explock"]`);

  // this loop is just for adding the new html to the menu on each pokemon
  for (var i = 0; i < menus.length; i++) {
    menus[i].after(newHtml);
    newHtml.outerHTML = optionHtml;
  }
  // now we query our new label we inserted and add event listeners to each
  const labels = document.querySelectorAll("label#changeDelta");
  for (var j = 0; j < labels.length; j++) {
    labels[j].addEventListener("click", function (e) {
      // grabbing the target div with background image to modify
      const targetEle = this.parentElement.parentElement.querySelector(".pkmn").querySelector(".pokemon");
      // close the menu once an option is selected
      const currMenu = this.parentElement.parentElement;
      currMenu.classList.remove('menu');

      // create the dialogue where you can choose which delta type to preview
      const dialogue = document.createElement("div");
      document.querySelector("#core").classList.add("scrolllock");
      document.body.appendChild(dialogue);
      dialogue.outerHTML = `
        <div class="changedelta dialog">
        <div>
        <div>
        <div>
        <h3>Preview Delta Type</h3>
        <div>
        <p>Select a Delta Type to preview: <select id="delta-type-select">
        <option value="none">None</option>
        <option value="normal">Normal</option>
        <option value="fire">Fire</option>
        <option value="water">Water</option>
        <option value="electric">Electric</option>
        <option value="grass">Grass</option>
        <option value="ice">Ice</option>
        <option value="fighting">Fighting</option>
        <option value="poison">Poison</option>
        <option value="ground">Ground</option>
        <option value="flying">Flying</option>
        <option value="psychic">Psychic</option>
        <option value="bug">Bug</option>
        <option value="rock">Rock</option>
        <option value="ghost">Ghost</option>
        <option value="dragon">Dragon</option>
        <option value="dark">Dark</option>
        <option value="steel">Steel</option>
        <option value="fairy">Fairy</option>
        </select>
        </p>
        <button type="button" id="selectdelta" style="margin: 0px 8px 0px 0px;">Select</button><button type="button" id="closechangedelta" style="float: right; margin: 0px 0px 0px 8px;" data-cancelbutton="1">Cancel</button></div></div></div></div></div>
      `;

      // wait for user to close or select delta type, then act accordingly
      document.querySelector("#closechangedelta").addEventListener("click", function () {
        document.querySelector("div.changedelta").remove();
        document.querySelector("#core").classList.remove('scrolllock');
      });

      document.querySelector("#selectdelta").addEventListener("click", function () {
        // grab our selected value
        const selectedType = document.querySelector("#delta-type-select").value;
        // grab existing background image url to manipulate
        // also grab from static rather than r2, necessary as of 7/9/2025 server migration
        var url = targetEle.style.backgroundImage.replace("r2", "static");
        var noDeltaUrl = "";
        // regex time
        // example URLs:
        // https://static.pokefarm.com/img/pkmn/o/o/g/delta-water.png/t=1750511298.png
        // https://static.pokefarm.com/img/pkmn/o/o/g.png/t=1750511298.png
        // token at the end is not required for our purposes

        if (url.includes("delta")) { //image we're manipulating already is a delta
          noDeltaUrl = url.replace(/\/delta-.*/, '') + `.png")`;
          if (selectedType == "none") { //then we want to make this delta into the normal image
            url = url.replace(/\/delta-.*/, '') + `.png")`;
          }
          else { // then we want to change this delta into a different delta type
            url = url.replace(/delta-.*/, 'delta-' + selectedType) + `.png")`;
          }
        }
        else { // image we're manipulating is not a delta yet
          noDeltaUrl = url;
          if (selectedType != "none") { //if they want to add a type
            url = url.replace(/\.png.*/, `/delta-` + selectedType + `.png")`);
          }
        }
        // logic for checking whether our image exists on the server and implementing changes
        checkImageExists(url, targetEle, noDeltaUrl, selectedType);
      });
    });
  }
})();
