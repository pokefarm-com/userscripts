'use strict';

/**
 * A library for accessing the PFQ API.
 * 
 * Setup:
 * ```js
 * const api = new PFQAPI();
 * api.ready.then(() => {...});
 * ```
 * 
 * If the user has not provided an API key, they will be prompted to enter one.
 * 
 * Once the API is ready, you can access the methods on the `api` object.
 * ```js
 * const badges = await api.badges();
 * ```
 * 
 * Note that some endpoints are rate-limited. In general, the developer should be mindful
 * of how many requests they make per minute. Local storage is recommended for caching data.
 */
class PFQAPI {
	// #region Tests
	/** @returns {Promise<{status:"ok"}>} */
	async test() {
		return PFQAPI.#request("/health");
	}
	// #endregion


	// #region User
	/**
	 * Get the current user's profile.
	 * 
	 * **Rate limit:** 10 requests per minute
	 * @returns {Promise<{
	 *  name: string,
	 *  displayname: string,
	 *  isStaff: boolean,
	 *  shortlink: string
	 * }>}
	 */
	async whoami() {
		return PFQAPI.#request("/user/me");
	}

	/**
	 * Get the current user's Wishforge badges.
	 * 
	 * @returns {Promise<Map<string,string>>} Map of type to name
	 */
	async badges() {
		return new Map((await PFQAPI.#request("/user/badges")).badges.map(badge => [badge.type, badge.name]));
	}

	/**
	 * Get various boosts related to shiny/albino/melan hunting.
	 * @returns {Promise<{
	 *  hypermode: boolean,
	 *  silverAmulet: boolean,
	 *  goldAmulet: boolean,
	 *  cobaltAmulet: boolean,
	 *  shinyCharm: boolean,
	 *  shinyChainName: string,
	 *  shinyChainCount: number,
	 *  shinyChainMiniCount: number,
	 *  shinyChainForme: string,
	 *  uberCharm: boolean,
	 *  typeRace: boolean,
	 *  albinoLevel: number,
	 *  zCrystal: boolean,
	 *  seiPower: number,
	 *  potd: boolean
	 * }>}
	 */
	async boosts() {
		return (await PFQAPI.#request("/user/boosts")).boosts;
	}

	/**
	 * Get a user's Gem counts.
	 * @returns {Promise<Map<string,number>>}
	 */
	async gems() {
		return new Map((await PFQAPI.#request("/user/inventory/gems")).gems.map(gem => [gem.name, gem.quantity]));
	}

	/**
	 * Get the user's currency.
	 * @returns {Promise<{
	 *  credits: number,
	 *  gold: number,
	 *  zophan: number
	 * }>}
	 */
	async currency() {
		return (await PFQAPI.#request("/user/inventory/currency")).currency;
	}

	/**
	 * Get the user's Type Race rotation.
	 * 
	 * The currently active type is tagged, eg. `fire [active]`
	 * @returns {Promise<string[]>}
	 */
	async #fetchTyperaceRotation() {
		// get from localstorage if possible
		const key = `${$.USER}.api.typeracerotation`;
		if (key in localStorage) {
			const cached = JSON.parse(localStorage[key]);
			if (cached.timestamp > Date.now()) {
				return cached.rotation;
			}
		}
		const rotation = (await PFQAPI.#request("/user/typerace/rotation")).rotation;
		// cache until start of next month
		const expires = new Date();
		expires.setUTCMonth(expires.getUTCMonth() + 1, 1);
		expires.setUTCHours(0, 0, 0, 0);
		localStorage[key] = JSON.stringify({ timestamp: expires.getTime(), rotation });
		return rotation;
	}

	/**
	 * Get the user's Type Race rotation.
	 * @returns {Promise<string[]>}
	 */
	async typeraceRotation() {
		const rotation = await this.#fetchTyperaceRotation();
		// remove the [active] tag
		rotation.forEach((type, i) => rotation[i] = type.replace(" [active]", ""));
		return rotation;
	}

	/**
	 * Get the user's current Type Race team.
	 * @returns {Promise<string>}
	 */
	async typeraceTeam() {
		const rotation = await this.typeraceRotation();
		// find the active type
		const active = rotation.find(type => type.includes(" [active]"));
		// remove the [active] tag
		return active.replace(" [active]", "");
	}
	// #endregion


	// #region Pokémon
	/**
	 * Get IV stats for a Pokémon
	 * @param {string} summary Just the ID part of the summary link.
	 * @returns {Promise<[
	 *  hp: number,
	 *  atk: number,
	 *  def: number,
	 *  sat: number,
	 *  sdf: number,
	 *  spd: number
	 * ]>}
	 */
	async ivs(summary) {
		return (await PFQAPI.#request(`/pokemon/iv?shortlink=${summary}`)).iv;
	}

	/**
	 * Get all IV stats for all Pokémon.
	 * 
	 * Usage: `for await (const [shortlink, iv] of api.allIvs()) { ... }`
	 * @returns {AsyncGenerator<[shortlink: string, iv: {
	 *  hp: number,
	 *  atk: number,
	 *  def: number,
	 *  sat: number,
	 *  sdf: number,
	 *  spd: number
	 * }]>}
	 */
	async *allIvs() {
		let pageNumber = 1;
		while (true) {
			const page = await PFQAPI.#request(`/pokemon/all-iv?page=${pageNumber}`);
			if (!page.ivs.length) {
				break;
			}
			for (const entry of page.ivs) {
				yield [entry.shortlink, entry.iv];
			}
			pageNumber++;
			if (pageNumber > page.pagination.totalPages) {
				break;
			}
		}
	}
	// #endregion


	// #region PokéDex
	/**
	 * @typedef {{sprite:string,icon:string}} SpriteWithIcon
	 * @typedef {{sprite:string,icon:string,shiny:SpriteWithIcon,albino:SpriteWithIcon,melan:SpriteWithIcon}} SpriteWithVariants
	 * @typedef {{egg:string|null,male:SpriteWithVariants,female:SpriteWithVariants|null}} SpriteList
	 * 
	 * @typedef {Object} PokedexEntry
	 * @property {string} formeid
	 * @property {string} name
	 * @property {string} region
	 * @property {[string]|[string,string]} type
	 * @property {[string]|[string,string]} egggroup
	 * @property {string} bodytype
	 * @property {[normal:string,shiny:string]} colour
	 * @property {string|null} eggdesc
	 * @property {string} pkmndesc
	 * @property {{hp:number,atk:number,def:number,sat:number,sdf:number,spd:number}} stats
	 * @property {number} height
	 * @property {number} weight
	 * @property {number} stepsToHatch
	 * @property {string} genders
	 * @property {SpriteList} sprites
	 */
	/**
	 * Get the Pokedex.
	 * 
	 * **Rate limit:** 10 requests per minute
	 * @returns {Promise<Map<string,PokedexEntry>>}
	 * Map of formeid to entry
	 */
	async #pokedex() {
		/**
		 * @typedef {Object} RawEntry
		 * @property {string} bodytype
		 * @property {[normal:string,shiny:string]} colors
		 * @property {string|null} eggdesc
		 * @property {string[]} egggroup
		 * @property {number} expToHatch
		 * @property {string} formeid
		 * @property {string} formename
		 * @property {string} genders
		 * @property {string} name
		 * @property {string} pkmndesc
		 * @property {{height:number,weight:number}} size
		 * @property {{[key:string]:string}} sprites
		 * @property {{hp:number,atk:number,def:number,spAtk:number,spDef:number,spd:number}} stats
		 * @property {[string]|[string,string]} types
		 */
		/** @type {{region_name:string,pokemon:RawEntry[]}[]} */
		const dex = await PFQAPI.#request("/pokemon/dex?components=100,101,102,103,104,105,106,107,108");
		/** @type {Map<string,PokedexEntry>} */
		const map = new Map();
		function convertSpriteIdToUrl(file) {
			return file ? `https://static.pokefarm.com/img/pkmn/${file}` : null;
		}
		for (const { region_name, pokemon } of dex) {
			for (const entry of pokemon) {
				const region = region_name + (region_name === 'PokéFarm Q'
					? (parseInt(entry.formeid, 10) === 0
						? ' (Exclusives)'
						: (
							entry.formeid.match(/-Q$/)
								? ' (Megas)'
								: ' (Variants)'
						)
					)
					: ''
				);
				map.set(entry.formeid, {
					formeid: entry.formeid,
					name: `${entry.name}/${entry.formename}`,
					region: region,
					type: entry.types,
					egggroup: entry.egggroup.split("/"),
					bodytype: entry.bodytype,
					colour: entry.colors,
					eggdesc: entry.eggdesc,
					pkmndesc: entry.pkmndesc,
					stats: {
						hp: entry.stats.hp,
						atk: entry.stats.atk,
						def: entry.stats.def,
						sat: entry.stats.spAtk,
						sdf: entry.stats.spDef,
						spd: entry.stats.spd,
					},
					height: entry.size.height,
					weight: entry.size.weight,
					stepsToHatch: entry.expToHatch,
					genders: entry.genders,
					sprites: entry.sprites ? {
						egg: entry.sprites.egg ? convertSpriteIdToUrl(entry.sprites.egg) : null,
						male: {
							sprite: convertSpriteIdToUrl(entry.sprites.m),
							icon: convertSpriteIdToUrl(entry.sprites['m-icon']),
							shiny: {
								sprite: convertSpriteIdToUrl(entry.sprites.ms),
								icon: convertSpriteIdToUrl(entry.sprites['ms-icon'])
							},
							albino: {
								sprite: convertSpriteIdToUrl(entry.sprites.ma),
								icon: convertSpriteIdToUrl(entry.sprites['ma-icon'] ?? entry.sprites['m-icon'])
							},
							melan: {
								sprite: convertSpriteIdToUrl(entry.sprites.mm),
								icon: convertSpriteIdToUrl(entry.sprites['ms-icon'] ?? entry.sprites['m-icon'])
							}
						},
						female: entry.sprites.f ? {
							sprite: convertSpriteIdToUrl(entry.sprites.f),
							icon: convertSpriteIdToUrl(entry.sprites['f-icon']),
							shiny: {
								sprite: convertSpriteIdToUrl(entry.sprites.fs),
								icon: convertSpriteIdToUrl(entry.sprites['fs-icon'])
							},
							albino: {
								sprite: convertSpriteIdToUrl(entry.sprites.fa),
								icon: convertSpriteIdToUrl(entry.sprites['fa-icon'] ?? entry.sprites['f-icon'])
							},
							melan: {
								sprite: convertSpriteIdToUrl(entry.sprites.fm),
								icon: convertSpriteIdToUrl(entry.sprites['fs-icon'] ?? entry.sprites['f-icon'])
							}
						} : null
					} : null
				});
			}
		}
		return map;
	}

	/**
	 * Get an object that can be used to query the Pokédex.
	 */
	async pokedex() {
		const manager = this.#dexManager;
		await manager.ready;
		return manager;
	}
	// #endregion


	// #region Implementation
	constructor() {
		this.ready = PFQAPI.ready;
	}
	/** @type {Promise<never,string>} */
	static ready;
	static #ready = false;
	/** @type {string} */
	static #apiKey;
	static {
		const promise = new Promise((resolve, reject) => {
			const key = `${$.USERID}.userscript-api-key`;
			if (key in localStorage) {
				this.#apiKey = localStorage[key];
				this.#ready = true;
				resolve();
			}
			else {
				reject("API Key not yet set");
			}
		});
		promise.catch(PFQAPI.#requestApiKeyFromUser);
		this.ready = promise;
	}

	static #requestApiKeyFromUser() {
		var li = $("<li>");
		li.html("<a href=\"#\" class=\"new\"><img src=\"/img/items/farmkey.png\" /> API Key</a>");
		$("#announcements>ul>li").eq(0).after(li);
		var btn = li.find(">a");
		btn.on("click", function () {
			new Dialog("API Key",
				"<p>A userscript is requesting access to the API.</p>"
				+ "<p>You can find or create an API key on the <a href=\"/farm#tab=5.7\">Farm page</a>.</p>"
				+ "<p>Enter your API key below:</p>"
				+ "<input type=\"password\" id=\"userscript-api-key\" placeholder=\"API Key\" />",
				[{
					text: "Save",
					action: function () {
						var apikey = $("#userscript-api-key").val();
						if (apikey) {
							const key = `${$.USERID}.userscript-api-key`;
							localStorage[key] = apikey;
							location.reload();
						}
					}
				}, "cancel"]
			);
		});
	}
	static #resetApiKey() {
		this.#apiKey = null;
		const key = `${$.USERID}.userscript-api-key`;
		delete localStorage[key];
	}

	static #request(path, method = "GET") {
		if( !this.#ready) throw new Error("API Key not yet set");
		return new Promise((resolve, reject) => {
			var xhr = $.ajax({
				url: `https://api.pokefarm.com/v1${path}`,
				headers: {
					"X-Api-Key": this.#apiKey,
				},
				method: method,
				dataType: "json"
			});
			xhr.done(data => resolve(data));
			xhr.fail((xhr, err) => {
				if (xhr.status == 401 || xhr.status == 403) {
					PFQAPI.#resetApiKey();
				}
				reject(err);
			});
		});
	}
	// #endregion


	// #region Dex Implementation
	get #dexManager() {
		const getDexFromApi = this.#pokedex;
		class Dex {
			constructor() {
				/** @type {Promise<void,string>} */
				this.ready = new Promise(async (resolve, reject) => {
					const openRequest = indexedDB.open("userscript-api-dex", 1);
					openRequest.onerror = (event) => {
						console.error(event);
						reject("Failed to start database");
					};
					openRequest.onsuccess = async (event) => {
						this.#db = event.target.result;
						await this.#loadDex();
						resolve();
					};
					openRequest.onupgradeneeded = async (event) => {
						this.#db = event.target.result;
						const store = this.#db.createObjectStore("dex", { keyPath: "formeid" });
						store.createIndex("name", "name", { unique: true });
						store.createIndex("region", "region");
						store.createIndex("type", "type", { multiEntry: true });
						store.createIndex("egggroup", "egggroup", { multiEntry: true });
						await this.#loadDex(true);
						resolve();
					};
				});
				this.ready.catch(console.error);
			}

			/** @type {IDBDatabase} */
			#db;

			#loadDex(force = false) {
				return new Promise(async (resolve,reject) => {
					const localStorageKey = `userscript-api-dex-cached-at`;
					const cachedAt = localStorage.getItem(localStorageKey);
					if (cachedAt && !force && Date.now() < +cachedAt + 3_600_000) {
						resolve();
					}
					else {
						const dex = await getDexFromApi();
						const transaction = this.#db.transaction("dex", "readwrite");
						transaction.onerror = (event) => {
							console.error(event);
							reject("Failed to load dex");
						};
						transaction.oncomplete = () => {
							localStorage.setItem(localStorageKey, Date.now().toString());
							resolve();
						};
						const store = transaction.objectStore("dex");
						for (const [formeid,pokemon] of dex) {
							store.put(pokemon);
						}
					}
				});
			}

			/**
			 * @param {string} formeid
			 * @returns {Promise<PokedexEntry,string>}
			 */
			get(formeid) {
				return new Promise((resolve,reject) => {
					const transaction = this.#db.transaction("dex");
					const store = transaction.objectStore("dex");
					const request = store.get(formeid);
					request.onsuccess = (event) => {
						const result = event.target.result;
						if( !result ) reject(`No such pokemon: ${formeid}`);
						else resolve(result);
					};
					request.onerror = (event) => {
						console.error(event);
						reject("Failed to get pokemon");
					};
				});
			}

			/**
			 * @param {string} index
			 * @param {string} value
			 * @returns {Promise<PokedexEntry[]>}
			 */
			#lookup(index, value) {
				return new Promise((resolve,reject) => {
					const transaction = this.#db.transaction("dex");
					const store = transaction.objectStore("dex");
					const request = store.index(index).getAll(value);
					request.onsuccess = (event) => {
						resolve(event.target.result);
					};
					request.onerror = (event) => {
						console.error(event);
						reject("Failed to get pokemon");
					};
				});
			}

			/**
			 * Get a single entry by name/forme
			 * @param {string} name
			 * @param {string} [formename]
			 * @returns {Promise<PokedexEntry>}
			 */
			async getByName(name, formename="") { return (await this.#lookup("name", `${name}/${formename}`))[0]; }
			region = {
				kanto: "Kanto",
				johto: "Johto",
				hoenn: "Hoenn",
				sinnoh: "Sinnoh",
				unova: "Unova",
				kalos: "Kalos",
				alola: "Alola",
				galar: "Galar",
				paldea: "Paldea",
				pfqMega: "PokéFarm Q (Megas)",
				pfqVariant: "PokéFarm Q (Variants)",
				pfqExclusive: "PokéFarm Q (Exclusives)"
			};
			/**
			 * Get a list of entries by region
			 * @param {string} region
			 * @returns {Promise<PokedexEntry[]>}
			 */
			getByRegion(region) { return this.#lookup("region", region); }
			type = {
				normal: "normal",
				fire: "fire",
				water: "water",
				electric: "electric",
				grass: "grass",
				ice: "ice",
				fighting: "fighting",
				poison: "poison",
				ground: "ground",
				flying: "flying",
				psychic: "psychic",
				bug: "bug",
				rock: "rock",
				ghost: "ghost",
				dragon: "dragon",
				dark: "dark",
				steel: "steel",
				fairy: "fairy"
			};
			/**
			 * Get a list of entries by type
			 * @param {string} type
			 * @param {string} [type2]
			 * @returns {Promise<PokedexEntry[]>}
			 */
			async getByType(type, type2=null) {
				const firstType = await this.#lookup("type", type);
				if( !type2 ) return firstType;
				const secondType = await this.#lookup("type", type2);
				const formeidsInSecondType = new Set(secondType.map(p => p.formeid));
				return firstType.filter(p => formeidsInSecondType.has(p.formeid));
			}
			egggroup = {
				undiscovered: "Undiscovered",
				monster: "Monster",
				dragon: "Dragon",
				field: "Field",
				bug: "Bug",
				grass: "Grass",
				water1: "Water 1",
				water2: "Water 2",
				water3: "Water 3",
				amorphous: "Amorphous",
				fairy: "Fairy",
				humanlike: "Human-Like",
				mineral: "Mineral",
				flying: "Flying",
				unown: "Unown",
				ditto: "Ditto"
			};
			/**
			 * Get a list of entries by egg group
			 * @param {string} egggroup
			 * @returns {Promise<PokedexEntry[]>}
			 */
			getByEggGroup(egggroup) { return this.#lookup("egggroup", egggroup); }
		}
		const dex = new Dex;
		Object.defineProperty(this, "#dexManager", { value: dex, writable: false, enumerable: false, configurable: false });
		return dex;
	}
	// #endregion
}
