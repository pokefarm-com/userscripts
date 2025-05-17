'use strict';

/**
 * A library for storing and retrieving per-script configuration settings.
 * 
 * Setup:
 * ```js
 * const config = await (new PersistentConfig(scriptName)).ready;
 * ```
 * It is up to the developer to ensure that the given script name is unique across all userscripts.
 * 
 * Once the config is ready, you can access the config data using the `get` and `set` methods.
 * ```js
 * config.set("answer", 42);
 * const answer = config.get("answer");
 * ```
 * 
 * Changes to configuration are only saved locally by default. Use the `persist` method to save changes to the server.
 * ```js
 * await config.persist();
 * ```
 * 
 * Configuration is cached in local storage to prevent duplicate requests to the server.  
 * If the user makes changes on another device, they won't be updated on this device.  
 * Use the `sync` method to force loading config from the server, overwriting any local data.
 * ```js
 * await config.sync();
 * ```
 * 
 * The developer can choose a strategy for when to `persist` and `sync`.  
 * This can be as simple as a button to trigger them, or some kind of version control embedded in the data.
 * 
 * **!! This library uses AJAX !!**  
 * This is normally not permitted in userscripts, but library-provided functions are exempt from this rule.  
 * However, the developer should keep server requests (`persist` and `sync`) to a minimum where possible.
 * 
 */
class PersistentConfig {
	/** @type {Promise<number,string>} */
	static #directoryId;
	/** @type {Promise<{[scriptName:string]:number},string>} */
	static #fileIds;
	static {
		this.#directoryId = this.#getDirectoryId();
		this.#fileIds = this.#getFileIds();
	}

	/**
	 * @type {Promise<PersistentConfig,string>} A promise that resolves with the created config object,
	 * or rejects with an error message if the config could not be loaded.
	 */
	ready;
	/** @type {string} */
	#scriptName;
	/** @type {{[key:string]:any}} */
	#data = {};
	#ready = false;
	/**
	 * Creates a new PersistentConfig instance.
	 * @param {string} scriptName The name of the script that this config belongs to.
	 */
	constructor(scriptName) {
		this.#scriptName = scriptName;
		this.ready = new Promise(async (resolve, reject) => {
			try {
				this.#data = await this.#loadConfigData();
				this.#ready = true;
				resolve(this);
			} catch (error) {
				reject(error);
			}
		});
	}

	// #region Public API
	/**
	 * Gets a value from the config.
	 * @param {string} key
	 * @param {any} [defaultValue]
	 * @returns {any}
	 */
	get(key, defaultValue=undefined) {
		if( !this.#ready ) throw new Error("Config is not ready yet");
		return this.#data[key] ?? defaultValue;
	}
	/**
	 * Sets a value in the config.
	 * @param {string} key
	 * @param {any} value
	 */
	set(key, value) {
		if( !this.#ready ) throw new Error("Config is not ready yet");
		this.#data[key] = value;
		this.#setConfigDataInLocalStorage(this.#data);
	}
	/**
	 * Force loading config from the server, clobbering any local data.
	 * @returns {Promise<void>}
	 */
	async sync() {
		if( !this.#ready ) throw new Error("Config is not ready yet");
		this.#setConfigDataInLocalStorage(null);
		this.#data = await this.#loadConfigData();
		this.#setConfigDataInLocalStorage(this.#data);
	}
	/**
	 * Persists the config to the server.
	 */
	async persist() {
		if( !this.#ready ) throw new Error("Config is not ready yet");
		await this.#persistConfigData(this.#data);
	}
	// #endregion

	// #region Directory
	/**
	 * Load the ID of the config directory.
	 * @returns {Promise<number,string>}
	 */
	static async #getDirectoryId() {
		return (await this.#getDirectoryIdFromLocalStorage())
			|| (await this.#getDirectoryIdFromServer())
			|| (await this.#createConfigDirectoryOnServer())
			|| Promise.reject("Failed to create config directory");
	}

	/**
	 * Fetch the ID of the config directory from local storage, if it has been cached.
	 * @returns {Promise<number|null,string>}
	 */
	static async #getDirectoryIdFromLocalStorage() {
		const key = $.USERID + ".userscript-config-directory-id";
		const directoryId = localStorage.getItem(key);

		return directoryId ? Number(directoryId) : null;
	}

	/**
	 * Cache the ID of the config directory in local storage.
	 * @param {number|null} directoryId
	 */
	static async #setDirectoryIdInLocalStorage(directoryId) {
		const key = $.USERID + ".userscript-config-directory-id";
		if( directoryId === null ) localStorage.removeItem(key);
		else localStorage.setItem(key, directoryId);
	}

	/**
	 * Fetch the ID of the config directory from the server.
	 * @returns {Promise<number|null,string>}
	 */
	static async #getDirectoryIdFromServer() {
		const configDirectoryName = ".userscript-config";
		// Load the Notepad root directory
		const rootDirectory = $((await this.#ajax("farm/notepad")).html);

		// Find the config directory
		const configDirectoryId = Number(
			rootDirectory.find("a[data-dir]")
				.filter(function() { return this.textContent === configDirectoryName; })
				.data("dir")
		);

		if( !configDirectoryId ) return null;
		await this.#setDirectoryIdInLocalStorage(configDirectoryId);
		return configDirectoryId;
	}

	/**
	 * Create the config directory on the server, and return its ID.
	 * @returns {Promise<number|null,string>}
	 */
	static async #createConfigDirectoryOnServer() {
		const configDirectoryName = ".userscript-config";

		await this.#ajax("farm/notepad", {
			mode: "newdir",
			save: { name: configDirectoryName }
		});

		return this.#getDirectoryIdFromServer();
	}
	// #endregion

	// #region File list
	/**
	 * Load the IDs of the config files.
	 * @returns {Promise<{[scriptName:string]:number},string>}
	 */
	static async #getFileIds() {
		try {
			return (await this.#getFileIdsFromLocalStorage())
				|| (await this.#getFileIdsFromServer());
		} catch (error) {
			if( error === "NotepadDirectory not found" ) {
				// most likely culprit: the config directory was deleted and a stale ID was cached
				// clear the cache and try again
				await this.#setDirectoryIdInLocalStorage(null);
				this.#directoryId = this.#getDirectoryId();
				// fetch again without this error handler - in case of repeat failure, just give up
				return await this.#getFileIdsFromServer();
			}
			return Promise.reject(error);
		}
	}

	/**
	 * Fetch the IDs of the config files from local storage, if they have been cached.
	 * @returns {Promise<{[scriptName:string]:number}|null,string>}
	 */
	static async #getFileIdsFromLocalStorage() {
		const key = $.USERID + ".userscript-config-file-ids";
		const fileIds = localStorage.getItem(key);

		if( !fileIds || fileIds.charAt(0) !== "{" ) return null;

		try {
			const parsed = JSON.parse(fileIds);
			// ensure that the value is a valid object containing file IDs
			if( typeof parsed === "object" && Object.values(parsed).every(v => typeof v === "number") ) return parsed;
			return null;
		} catch (error) {
			// malformed value, treat as nonexistent
			return null;
		}
	}
	/**
	 * Cache the IDs of the config files in local storage.
	 * @param {{[scriptName:string]:number}} fileIds
	 */
	static async #setFileIdsInLocalStorage(fileIds) {
		const key = $.USERID + ".userscript-config-file-ids";
		localStorage.setItem(key, JSON.stringify(fileIds));
	}

	/**
	 * Fetch the IDs of the config files from the server.
	 * Also creates a README file if necessary.
	 * @returns {Promise<{[scriptName:string]:number},string>}
	 */
	static async #getFileIdsFromServer() {
		const directoryId = await this.#directoryId;
		const configDirectory = $((await this.#ajax("farm/notepad",{directory: directoryId})).html);
		const configFileLinks = configDirectory.find("a[data-file]");

		/** @type {{[scriptName:string]:number}} */
		const fileIds = {};
		configFileLinks.each(function() {
			fileIds[this.textContent] = Number(this.dataset.file);
		});

		if( !fileIds[".README"]) {
			this.#createNewFile(".README").then(fileId => {
				this.#saveFile(fileId, ".README", "This folder is used to store per-script configuration settings.\n\n"
					+ "DO NOT manually edit these files, unless you know what you're doing.");
			});
		}

		await this.#setFileIdsInLocalStorage(fileIds);
		return fileIds;
	}
	// #endregion

	// #region File
	/**
	 * Create a new config file on the server, and return its ID.
	 * @param {string} fileName
	 * @returns {Promise<number,string>}
	 */
	static async #createNewFile(fileName) {
		const directoryId = await this.#directoryId;
		const editor = $("<div>"+(await this.#ajax("farm/notepad", {
			directory: directoryId,
			mode: "newfile",
			save: { name: fileName }
		})).html+"</div>");
		const fileId = Number(editor.find("form[data-fileform]").data("fileform"));
		
		const fileIds = await this.#fileIds;
		fileIds[fileName] = fileId;
		await this.#setFileIdsInLocalStorage(fileIds);

		return fileId;
	}

	/**
	 * Save a config file to the server.
	 * @param {number} fileId
	 * @param {string} fileName
	 * @param {string} content
	 */
	static async #saveFile(fileId, fileName, content) {
		return this.#ajax("farm/notepad", {
			file: fileId,
			mode: "save",
			save: { name: fileName, content: content }
		});
	}

	/**
	 * Return the ID of the config file for the current script.
	 * @returns {Promise<number,string>}
	 */
	async #getFileId() {
		const fileIds = await PersistentConfig.#fileIds;
		if( !fileIds[this.#scriptName] ) {
			const createdFileId = await PersistentConfig.#createNewFile(this.#scriptName);
			fileIds[this.#scriptName] = createdFileId;
			await PersistentConfig.#setFileIdsInLocalStorage(fileIds);
		}
		return fileIds[this.#scriptName];
	}
	// #endregion

	// #region Config data
	/**
	 * Load the config data from the server or local storage.
	 * @returns {Promise<{[key:string]:any},string>}
	 */
	async #loadConfigData() {
		try {
			return (await this.#loadConfigDataFromLocalStorage())
				|| (await this.#loadConfigDataFromServer());
		} catch (error) {
			if( error === "NotepadFile not found" ) {
				// file doesn't exist, delete its ID from local storage and retry
				const fileIds = await PersistentConfig.#fileIds;
				delete fileIds[this.#scriptName];
				await PersistentConfig.#setFileIdsInLocalStorage(fileIds);
				// fetch again from server
				return await this.#loadConfigDataFromServer();
			}
			if( error === "NotepadDirectory not found" ) {
				// the entire directory is missing, wipe it all and start over
				PersistentConfig.#setDirectoryIdInLocalStorage(null);
				PersistentConfig.#setFileIdsInLocalStorage({});
				PersistentConfig.#directoryId = PersistentConfig.#getDirectoryId();
				PersistentConfig.#fileIds = PersistentConfig.#getFileIds();
				// final attempt, an error here just gives up
				return await this.#loadConfigDataFromServer();
			}
			return Promise.reject(error);
		}
	}

	/**
	 * Fetch the config data from local storage, if it has been cached.
	 * @returns {Promise<{[key:string]:any}|null,string>}
	 */
	async #loadConfigDataFromLocalStorage() {
		const key = $.USERID + ".userscript-config-" + this.#scriptName;
		const data = localStorage.getItem(key);

		if( !data || data.charAt(0) !== "{" ) return null;

		try {
			return JSON.parse(data); // will be an object because it starts with "{"
		} catch (error) {
			// malformed value, treat as nonexistent
			return null;
		}
	}

	/**
	 * Save the config data to local storage.
	 * @param {{[key:string]:any}|null} data
	 */
	async #setConfigDataInLocalStorage(data) {
		const key = $.USERID + ".userscript-config-" + this.#scriptName;
		if( !data ) localStorage.removeItem(key);
		else localStorage.setItem(key, JSON.stringify(data));
	}

	/**
	 * Fetch the config data from the server.
	 * @returns {Promise<{[key:string]:any},string>}
	 */
	async #loadConfigDataFromServer() {
		const fileId = await this.#getFileId();
		const config = $((await PersistentConfig.#ajax("farm/notepad", {file: fileId})).html);
		const content = config.find("textarea[name=content]").val();

		if( !content || content.charAt(0) !== "{" ) return {};

		try {
			return JSON.parse(content); // will be an object because it starts with "{"
		} catch (error) {
			// malformed file, treat as empty
			return {};
		}
	}

	/**
	 * Save the config data to the server.
	 * @param {{[key:string]:any}} data
	 */
	async #persistConfigData(data) {
		const fileId = await this.#getFileId();
		try {
			await PersistentConfig.#saveFile(fileId, this.#scriptName, JSON.stringify(data, null, 2));
		} catch (error) {
			if( error === "NotepadDirectory not found" ) {
				// the entire directory is missing, wipe it all and start over
				PersistentConfig.#setDirectoryIdInLocalStorage(null);
				PersistentConfig.#setFileIdsInLocalStorage({});
				PersistentConfig.#directoryId = PersistentConfig.#getDirectoryId();
				PersistentConfig.#fileIds = PersistentConfig.#getFileIds();
			}
		}
		await this.#setConfigDataInLocalStorage(data);
	}
	// #endregion

	// #region Utils
	/**
	 * Wraps the game's built-in ajax function to use promises instead.
	 * @param {string} url
	 * @param {Object} [data]
	 * @returns {Promise<Object,string>}
	 */
	static async #ajax(url, data={}) {
		return new Promise((resolve, reject) => {
			window.ajax(url, data).success(resolve).failure(function(e) {
				reject(e.error);
				return false; // suppress default error handling
			});
		});
	}
	// #endregion
}
