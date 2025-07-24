/*
Delta Previewer by Corviknight [https://pfq.link/@Kp]
Adds an option to the Pokemon menu to preview a different Delta type or remove Delta type.
Due to an update to Delta image URLs/handling on 6/21/25, not all possible combinations are populated on the server yet, and it may return a 404 until one is hatched or is viewed naturally on the site. 
This is a known limitation, but the issue will lessen as more Delta combinations are viewed or discovered.
*/

(function() {
    'use strict';
    const optionHtml = `
    <hr>
    <label id="changeDelta">Preview Delta Type</label>
    `;
    const newHtml = document.createElement("div");

    //we grab these elements because i want to put our new html right after them
    const menus = document.querySelectorAll(`[data-menu="explock"]`);

    //this loop is just for adding the new html to the menu on each pokemon
    for(var i = 0; i<menus.length; i++) {
     menus[i].after(newHtml);
     newHtml.outerHTML = optionHtml;
    }
    //now we query our new label we inserted and add event listeners to each
    const labels = document.querySelectorAll("label#changeDelta");
    for(var j=0;j<labels.length;j++) {
     labels[j].addEventListener("click", function (e) {
         //grabbing the target div with background image to modify
         const targetEle = this.parentElement.parentElement.querySelector(".pkmn").querySelector(".pokemon");
         //close the menu once an option is selected
         const currMenu = this.parentElement.parentElement;
         currMenu.classList.remove('menu');

         //create the dialogue where you can choose which delta type to preview
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
         <br><br>
         <b>Note:</b> If the image fails to load, that may mean this combination has not existed/been loaded yet, or that this Pokémon is incapable of being Delta.
         </p>
         <button type="button" id="selectdelta" style="margin: 0px 8px 0px 0px;">Select</button><button type="button" id="closechangedelta" style="float: right; margin: 0px 0px 0px 8px;" data-cancelbutton="1">Cancel</button></div></div></div></div></div>
         `;

         //wait for user to close or select delta type, then act accordingly
         document.querySelector("#closechangedelta").addEventListener("click", function() {
            document.querySelector("div.changedelta").remove();
            document.querySelector("#core").classList.remove('scrolllock');
         });

         document.querySelector("#selectdelta").addEventListener("click", function() {
             //grab our selected value
             const selectedType = document.querySelector("#delta-type-select").value;
             //grab existing background image url to manipulate
             //also grab from static rather than r2, necessary as of 7/9/2025 server migration
             var url = targetEle.style.backgroundImage.replace("r2","static");
             //regex time
             //example URLs:
             //https://static.pokefarm.com/img/pkmn/o/o/g/delta-water.png/t=1750511298.png
             //https://static.pokefarm.com/img/pkmn/o/o/g.png/t=1750511298.png
             //token at the end is not required for our purposes

             if(url.includes("delta")) { //image we're manipulating already is a delta
                 if(selectedType == "none") { //then we want to make this delta into the normal image
                     url = url.replace(/\/delta-.*/,'') + `.png")`;
                     targetEle.style.backgroundImage = url;
                 }
                 else { //then we want to change this delta into a different delta type
                     url = url.replace(/delta-.*/,'delta-' + selectedType) + `.png")`;
                     targetEle.style.backgroundImage = url;
                 }
             }
             else { //image we're manipulating is not a delta yet
                 if(selectedType != "none") { //if they want to add a type
                     url = url.replace(/\.png.*/,`/delta-`+ selectedType + `.png")`);
                     targetEle.style.backgroundImage = url;
                 }
             }
             document.querySelector("div.changedelta").remove();
             document.querySelector("#core").classList.remove('scrolllock');
         });

     });
    }

})();
