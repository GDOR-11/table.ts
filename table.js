import fs from "fs";

export class TableProperty {
    constructor(validationFunction, name) {
        this.validationFunction = validationFunction;
        this.name = name;
    }

    get validationFunction() {
        return this.#validationFunction;
    }
    set validationFunction(validationFunction) {
        if(typeof validationFunction == "function") {
            this.#validationFunction = validationFunction;
        } else {
            throw new TypeError("Property validation function must be a function (duh)");
        }
    }

    get name() {
        return this.#name;
    }
    set name(name) {
        if(typeof name === "string") {
            this.#name = name;
        } else {
            throw TypeError("Property name must be a string");
        }
    }
}
export class TableChange {
    static #types = Object.freeze({
        insert: Symbol("insert"),
        delete: Symbol("delete"),
        edit: Symbol("edit")
    });
    static get types() {
        return TableChange.#types;
    }

    constructor(type, ...data) {
        this.type = type;
        this.data = data;
    }

    get type() {
        return this.#type;
    }
    set type(type) {
        if(type === undefined || TableChange.#types[type] === undefined) {
            throw TypeError("Type must be a property of the TableChange.types enum");
        }
        this.#type = type;
    }
}
export class TableRow {
    constructor(data, tableProperties) {
        this.setData(data, tableProperties)
    }

    get data() {
        return this.#data;
    }
    setData(newData, tableProperties) {
        for(let property of tableProperties) {
            if(newData[property.name] === undefined) {
                throw TypeError(`The provided data does not contain the property ${property.name}`);
            }
            if(!tableProperties.validationFunction(newData[property.name])) {
                throw TypeError(`The provided data does not meet the required condition for the property ${property.name}`);
            }
        }
        this.#data = newData;
    }

    toString() {
        return "\"" + this.#data.map(col => col.toString().replaceAll("\"", "\"\"")).join("\",\"") + "\"";
    }
    fromString(string) {
        let data_str = [""];
        for(let i = 1;i < string.length;i++) {
            switch(string[i]) {
                case "\"":
                    if(string[i + 1] == "\"") {
                        data_str[data_str.length - 1] += "\"";
                        i++;
                    } else if(string[i + 1] == ",") {
                        data_str.push("");
                        i += 2;
                    }
                    break;
                default:
                    data_str[data_str.length - 1] += string[i];
            }
        }
    }
}
export class Table {
    constructor(properties, rows = []) {
        this.#properties = [];
        this.#rows = [];
        this.#changes = [];

        if(!(properties instanceof Array)) {
            throw TypeError("properties must be an array");
        }
        for(let property of properties) {
            if(!(property instanceof TableProperty)) {
                throw TypeError("all elements of the properties parameter must be an instance of TableProperty");
            }
            properties.push(property);
        }

        if(!(rows instanceof Array)) {
            throw TypeError("rows must be an array");
        }
        for(let row of properties) {
            if(!(property instanceof TableProperty)) {
                throw TypeError("all elements of the properties parameter must be an instance of TableProperty");
            }
            properties.push(property);
        }
    }

    #saveRows(file) {
        fs.writeFile(file, rows.map(row => ))
    }
    #saveChanges(file) {

    }
    
    save(file) {
        if(this.#changes.length > this.#rows.length) {
            this.#saveRows(file);
        } else {
            this.#saveChanges(file);
        }
    }

    getRow(condition) {
        for(let i = 0;i < this.#rows.length;i++) {
            if(condition(this.#rows[i])) {
                return this.#rows[i];
            }
        }
        return undefined;
    }
    getRows(condition) {
        let rows = [];
        for(let i = 0;i < this.#rows.length;i++) {
            if(condition(this.#rows[i])) {
                rows.push(this.#rows[i]);
            }
        }
        return rows;
    }

    insertRow(row) {
        let newRow = [];
        for(let property of this.#properties) {
            if(property.condition(row[property.name])) {
                newRow[property.name] = row[property.name];
            } else {
                throw TypeError(`Data type for property ${property.name} is incorrect (should be ${property.type})`);
            }
        }
        this.#rows.push(newRow);
        this.#changes.push(new TableChange(TableChange.types.insert, newRow));
    }

    deleteRow(condition) {
        for(let i = this.#rows.length - 1;i >= 0;i--) {
            if(condition(this.#rows[i])) {
                condition.splice(i, 1);
                this.#changes.push(new TableChange(TableChange.types.delete, i));
                return;
            }
        }
    }
    deleteRows(condition) {
        for(let i = this.#rows.length - 1;i >= 0;i--) {
            if(condition(this.#rows[i])) {
                condition.splice(i, 1);
                this.#changes.push(new TableChange(TableChange.types.delete, i));
            }
        }
    }

    editRow(condition, change) {
        for(let i = 0;i < this.#rows.length;i++) {
            if(condition(this.#rows[i])) {
                let newRow = change(this.#rows[i]);
                this.#rows[i] = change(this.#rows[i]);
                this.#changes.push(new TableChange(TableChange.types.edit, i, this.#rows[i]));
                return;
            }
        }
    }
    editRows(condition, change) {
        for(let i = 0;i < this.#rows.length;i++) {
            if(condition(this.#rows[i])) {
                this.#rows[i] = change(this.#rows[i]);
                this.#changes.push(new TableChange(TableChange.types.edit, i, this.#rows[i]));
            }
        }
    }


    get properties() {
        return this.#properties;
    }
}