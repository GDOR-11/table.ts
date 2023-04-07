import * as fs from "fs";

/**
 * clones an arbitrairily nested array. If the array contains objects that are not arrays, those won't be cloned.
 * this is around 8 times faster than structuredClone, and has greater support. The downside is that it only works with arrays.
 * @param array the array to clone
 * @returns the same array, but cloned
 */
function cloneArray(array: any[]): any[] {
    let clonedArray: any[] = [];
    for(let element of array) {
        if(element instanceof Array) {
            clonedArray.push(cloneArray(element));
        } else {
            clonedArray.push(element);
        }
    }
    return clonedArray;
}

class Table {
    //#region properties
    private _columns: Array<string> = [];
    private _data: Array<Array<string>> = [];
    //#endregion properties

    //#region constructor
    /**
     * creates a new table with the specified column names and data. The columns (and consequently the structure) of the table cannot be changed after creation
     * @param {Array<string>} columns the names of the columns (e.g. ["country name", "birth rate", "death rate", etc.])
     * @param {Array<Array<string>>} [data = []] all the data (amt of columns within each row must match amt of column names). Defaults to []
     */
    constructor(columns: Array<string>, data?: Array<Array<string>>);
    /**
     * reads the column names and the data from the file. The columns (and consequently the structure) of the table cannot be changed after creation
     * @param {string} filename the name of the file
     */
    constructor(filename: string, callbackFn?: (error: Table.Error | null) => void);
    constructor(first: Array<string> | string, second?: Array<Array<string>> | ((error: Table.Error | null) => void)) {
        if(typeof first == "string") /** get column names and data from file (read an existing table from a file) */{
            //#region args
            const filename = first;
            const callbackFn = (second || (() => {})) as (error: Table.Error | null) => void;
            //#endregion args

            this.getDataFrom(filename, callbackFn);
        } else /** programmer-specified column names and data (a new table is being created) */ {
            //#region args
            const columns = first;
            const data = (second || []) as string[][];
            //#endregion args

            this.columns = columns;
            this.data = data;
        }
    }
    //#endregion constructor

    //#region methods

    toString(): string {
        function convertToproperStr(str: string): string {
            let needsQuotes = str[0] == "\"";
            let properString = "\"";
            for(let k = 0;k < str.length;k++) {
                switch(str[k]) {
                    case "\"":
                        properString += "\"\"";
                        break;
                    case ",":
                    case "\n":
                        needsQuotes = true;
                    default:
                        properString += str[k];
                }
                if(str[k] == ",") {
                    needsQuotes = true;
                }
            }
            if(needsQuotes) {
                return properString + "\"";
            } else {
                return str;
            }
        }

        let str = "";
        for(let i = 0;i < this._columns.length;i++) {
            str += (i != 0 ? "," : "") + convertToproperStr(this._columns[i]);
        }

        // nothing more to do
        if(this._data.length == 0) return str;

        str += "\n";
        for(let i = 0;i < this._data.length;i++) {
            if(i != 0) str += "\n";
            for(let j = 0;j < this._data[i].length;j++) {
                str += (j != 0 ? "," : "") + convertToproperStr(this._data[i][j]);
            }
        }
        return str;
    }

    /**
     * saves the data to the given file (even simple changes might take a while since this function rewrites the entire thing)
     * @param {string} filename the file name
     * @returns {Promise<void>} the rejection type is Table.Error
     */
    saveTo(filename: string): Promise<void>;
    /**
     * saves the data to the given file (even simple changes might take a while since this function rewrites the entire thing)
     * @param filename the file name
     * @param callbackFn gets called when the operation is completed
     * @returns {void}
     */
    saveTo(filename: string, callbackFn: (error: Error | null) => void): void;
    saveTo(filename: string, callbackFn?: (error: Error | null) => void): Promise<void> | void {
        let promise: Promise<void> = new Promise((resolve, reject) => {
            fs.writeFile(filename, this.toString(), error => {
                if(error) {
                    return reject(<Table.Error> {
                        type: Table.ErrorTypes.CannotAccessFile,
                        description: `An error happened while trying to write to file ${filename}`,
                        data: error,
                        dataDescription: "The error"
                    });
                }
                resolve();
            });
        });
        if(callbackFn) {
            promise.then(() => callbackFn(null)).catch(callbackFn);
        } else {
            return promise;
        }
    }

    /**
     * reads data from the given file, which is assumed to be a "proper" csv file
     * ```csv
     * first sentence,second sentence,third sentence,fourth sentence
     * the first, row dictates, the names, of each column
     * this is one column,this is another one,oh god another column!,lots of columns yay
     * "if there is a double quote at the beggining of any column, the column is said to be quoted","a column needs to be quoted when its content contains a comma, a newline
     * (this is still the same column from the same row, but the content now has a newline) or when its content starts with a double quote","inside any quoted column, to represent an actual double quote you need 2 double quotes ("" means a single double quote)",if you are in an unquoted column you can put " quotes """ everywhere (here "" means two double quotes) but you can't use commas or newlines here
     * the amount, of columns, must stay, the same no matter what
     * "if you want you can","unnecessarily make","a column double-quoted","even if it doesn't have commas or newlines or if it doesn't start with """
     * a few examples,"""",means a single double quote,and cannot be un-quoted
     * example 2,""",""",means double quote comma double quote (","),and cannot be un-quoted too
     * example 3,"""""""",means three double quotes ("""),and cannot be un-quoted too
     * ```
     */
    private getDataFrom(filename: string, callbackFn?: (error: Table.Error | null) => void): Promise<void> | void {
        let promise: Promise<void> = new Promise((resolve, reject) => {
            fs.readFile(filename, "utf-8", (error, content) => {
                if(error) {
                    return reject(<Table.Error> {
                        type: Table.ErrorTypes.CannotAccessFile,
                        description: `An error happened while trying to read file ${filename}`,
                        data: error,
                        dataDescription: "The error"
                    });
                }
                function parseColumn(data: string, index: number): {parsedColumn: string, endIndex: number} {
                    let parsedColumn = "";
                    let insideQuotes = data[index] == "\"";
                    if(insideQuotes) {
                        for(let i = index + 1;i < data.length - 1;i++) {
                            if(data[i] != "\"") {
                                parsedColumn += data[i];
                                continue;
                            }
                            if(data[i + 1] == "\"") {
                                parsedColumn += data[i++];
                                continue;
                            }
                            return {parsedColumn, endIndex: i + 1};
                        }
                        return {parsedColumn, endIndex: data.length};
                    } else {
                        for(let i = index;i < data.length;i++) {
                            switch(data[i]) {
                                case ",":
                                case "\n":
                                    return {parsedColumn, endIndex: i};
                                default:
                                    parsedColumn += data[i];
                            }
                        }
                        return {parsedColumn, endIndex: data.length};
                    }
                }
                function parseRow(data: string, index: number): {parsedRow: string[], endIndex: number} {
                    let parsedRow: string[] = [];
                    while(true) {
                        let {parsedColumn, endIndex} = parseColumn(data, index);
                        switch(data[endIndex]) {
                            case ",":
                                parsedRow.push(parsedColumn);
                                index = endIndex + 1;
                                break;
                            case undefined:
                            case "\n":
                                if(parsedColumn != "") parsedRow.push(parsedColumn);
                                return {parsedRow, endIndex};
                        }
                    }
                }
                let data: string[][] = [];
                let columns: string[] = [];

                let i = 0;
                ({parsedRow: columns, endIndex: i} = parseRow(content, i));

                while(i != content.length) {
                    let parsedRow: string[];
                    ({parsedRow, endIndex: i} = parseRow(content, i + 1));
                    if(parsedRow.length != columns.length) return reject(<Table.Error> {
                        type: Table.ErrorTypes.InconsistentRowLengths,
                        description: `The row number ${data.length + 1} does not have the correct amount of columns (it has ${parsedRow.length} instead of ${columns.length})`
                    });
                    data.push(parsedRow);
                }
                this._columns = columns;
                this._data = data;
                return resolve();
            });
        });
        if(callbackFn) {
            promise.then(() => callbackFn(null)).catch(callbackFn);
        } else {
            return promise;
        }
    }
    //#endregion methods

    //#region getters & setters

    /** the data duh */
    public get data(): Array<Array<string>> {
        return cloneArray(this._data);
    }
    public set data(data: Array<Array<string>>) {
        for(let i = 0;i < data.length;i++) {
            if(data[i].length != this._columns.length) {
                throw <Table.Error> {
                    type: Table.ErrorTypes.InconsistentRowLengths,
                    description: `The row number ${i + 1} does not have the correct amount of columns (it has ${data[i].length} instead of ${this._columns.length})`
                };
            }
        }
        this._data = data;
    }

    /** the column names duh */
    public get columns(): Array<string> {
        return cloneArray(this._columns);
    }
    private set columns(columns: Array<string>) {
        this._columns = columns;
    }
    //#endregion
}
namespace Table {
    /** describes an error that might happen when doing something with a table */
    export interface Error {
        /** the type of the error duh */
        type: ErrorTypes;
        /** the description of the error duh */
        description?: string;
        /** any data that might be related the the error or useful for debugging it */
        data?: any;
        /** the description of the data, if it exists */
        dataDescription?: string;
    }
    /** types of errors that might happen when doing something with a table */
    export enum ErrorTypes {
        /** rows have inconsistent lengths (e.g. row 3 has 5 columns while the table just has 3 columns or the other way around) */
        InconsistentRowLengths,
        /** if you need extra clarification on what this means, get out of here and never read my code again */
        CannotAccessFile,
        /** if you need extra clarification on what this means, get out of here and never read my code again */
        Unknown
    }
}

export default Table;