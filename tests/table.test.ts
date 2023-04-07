import Table from "../src/index";
import * as fs from "fs";

/** describes a file */
interface File {
    /** the name of the file (didn't use fs.PathOrFileDescriptor cause it's just worse to deal with lol) */
    filepath: string;
    /** the contents of the file */
    filedata: string;
}
/** describes a (valid) table, and its corresponding file. Errors must be handled individually */
interface Example extends File {
    /** the columns of the table */
    columns: string[];
    /** the data of the table */
    data: string[][];
}


function mockFunction<T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> {
    return fn as jest.MockedFunction<T>;
}
function generateFileHierarchy(files: File[]) {
    let fileHierarchy = {};
    for(let {filepath, filedata} of files) {
        let path = filepath.split("/");
        if(path.length == 0) continue;
    
        let filename = path.pop() as string;
        let currentDirectory = fileHierarchy;
        for(let directory of path) {
            if(currentDirectory[directory] === undefined) {
                currentDirectory[directory] = {};
            }
            currentDirectory = currentDirectory[directory];
        }
        if(currentDirectory[filename] !== undefined) {
            throw `Filepath ${filepath} repeats more than once in the examples`;
        }
        currentDirectory[filename] = filedata;
    }
    return fileHierarchy;
}

jest.mock("fs");
//#region mocks
const writeFileMock = mockFunction(fs.writeFile);
const readFileMock = mockFunction<(path: fs.PathOrFileDescriptor, options: BufferEncoding, callbackFn: (error: NodeJS.ErrnoException | null, data: string) => void) => void>(fs.readFile);
//#endregion mocks
readFileMock.mockImplementation((path, options, callbackFn) => {
    for(let {filepath, filedata} of examples) {
        if(filepath === path) {
            return callbackFn(null, filedata);
        }
    }
});

const examples: Example[] = [
    {
        filepath: "file1.csv",
        filedata: "name,age,height,mass\nCarlos,34,1.87,93\nFabiano,94,1.94,122\nNicole,16,1.67,75",
        columns: ["name", "age", "height", "mass"],
        data: [["Carlos", "34", "1.87", "93"], ["Fabiano", "94", "1.94", "122"], ["Nicole", "16", "1.67", "75"]]
    },
    {
        filepath: "file2.csv",
        filedata: "column1,column2,column3\ndata1,data2,data3\ndata4,data5,data6\ndata7,data8,data9",
        columns: ["column1", "column2", "column3"],
        data: [["data1", "data2", "data3"], ["data4", "data5", "data6"], ["data7", "data8", "data9"]]
    },
    {
        filepath: "directory64/data.csv",
        filedata: "column1,column2,column4\ndata47,data2,data3\ndata4,data5,data6\ndata7,data8,data9",
        columns: ["column1", "column2", "column4"],
        data: [["data47", "data2", "data3"], ["data4", "data5", "data6"], ["data7", "data8", "data9"]]
    },
    {
        filepath: "empty.csv",
        filedata: "",
        columns: [],
        data: []
    },
    {
        filepath: "nodata.csv",
        filedata: "column1,column2,column3",
        columns: ["column1", "column2", "column3"],
        data: []
    }
];


const fileHierarchy = generateFileHierarchy(examples);


test("Initializing table with certain properties works", () => {
    for(let {columns, data} of examples) {
        let table = new Table(columns, data);
        expect(table.columns).toEqual(columns);
        expect(table.data).toEqual(data);
    };
});

test("Initializing table with a certain file works", () => {
    for(let {filepath, filedata, columns, data} of examples) {
        let table = new Table(filepath);
        expect(readFileMock).toHaveBeenLastCalledWith(filepath, expect.any(String), expect.any(Function));
        expect(table.columns).toEqual(columns);
        expect(table.data).toEqual(data);
    };
});

test("Converting table to string works", () => {
    for(let {filedata, columns, data} of examples) {
        let table = new Table(columns, data);
        expect(table.toString()).toBe(filedata);
    };
});

test("Saving table to file works", async () => {
    for(let {filepath, filedata, columns, data} of examples) {
        let mockFS = () => {
            writeFileMock.mockImplementationOnce((_filename, _data, callbackFn) => {
                expect(_filename).toBe(filepath);
                expect(_data).toBe(filedata);
                callbackFn(null);
            });
        };

        let table = new Table(columns, data);

        mockFS();
        await table.saveTo(filepath);

        mockFS();
        table.saveTo(filepath, error => {
            expect(error).toBe(null);
        });
    };
});

test("Initializing table with inconsistent row lengths throws expected error", () => {
    function testInconsistentRowLengths(columns: string[], data: string[][]): void {
        expect(() => new Table(columns, data)).toThrow(expect.objectContaining({type: Table.ErrorTypes.InconsistentRowLengths}));
    }
    testInconsistentRowLengths(["name", "gender", "age"], [["Pedro", "M"], ["Isabella", "F"], ["Matias", "M"]]);
    testInconsistentRowLengths(["name", "gender", "age"], [["Pedro", "M"], ["Isabella", "F", "42"], ["Matias", "M", "33"]]);
    testInconsistentRowLengths(["name", "gender", "age"], [["Pedro", "M", "33"], ["Isabella", "F"], ["Matias", "M", "33"]]);
    testInconsistentRowLengths(["name", "gender", "age"], [["Pedro", "M", "33"], ["Isabella", "F", "42"], ["Matias", "M"]]);
})

// if this test is taking too much time/memory (not currently an issue for me), reduce maxStrLen, maxDataLen or amtOfTests (all have equal weights on performance)
test("Altering the data works", () => {
    const maxStrLen = 100;
    const maxDataLen = 100;
    const amtOfTests = 10;
    function generateRandomString(length: number = Math.random() * maxStrLen): string {
        let string = "";
        for(let i = 0;i < length;i++) {
            string += String.fromCharCode(Math.random() * 95 + 32);
        }
        return string;
    }
    function generateRandomData(amtOfColumns: number, amtOfRows: number = Math.random() * maxDataLen): string[][] {
        let data: string[][] = [];
        for(let i = 0;i < amtOfRows;i++) {
            data[i] = [];
            for(let j = 0;j < amtOfColumns;j++) {
                data[i][j] = generateRandomString();
            }
        }
        return data;
    }

    for(let {columns, data} of examples) {
        let table = new Table(columns, data);
        expect(table.columns).toEqual(columns);
        expect(table.data).toEqual(data);

        // alter the data multiple times just to make sure lol
        for(let i = 0;i < amtOfTests;i++) {
            let newData = generateRandomData(columns.length);
            table.data = newData;
            expect(table.data).toEqual(newData);
        }
    }
});

test("Cannot alter data to become invalid", () => {
    let columns = ["name", "gender", "age"];
    let data = [["Pedro", "M", "33"], ["Isabella", "F", "42"], ["Matias", "M", "94"]];
    let table = new Table(columns, data);

    // now do everything in our reach to make the data invalid!

    // if the tests are failing here its because you forgot to clone the data in the Table.data getter (if table.#data === data, then you can just alter data and table.#data will alter too since its just one array/object shared between 2 variables)
    expect(table.data).not.toBe(data);

    // if the tests are failing here its because you forgot to check for validity in the Table.data setter
    function testDirectAssignment(data: string[][]) {
        expect(() => table.data = data).toThrow(expect.objectContaining({type: Table.ErrorTypes.InconsistentRowLengths}));
    }
    testDirectAssignment([["Pedro", "M"], ["Isabella", "F", "42"], ["Matias", "M", "94"]]);
    testDirectAssignment([["Pedro", "M", "33"], ["Isabella", "F"], ["Matias", "M", "94"]]);
    testDirectAssignment([["Pedro", "M", "33"], ["Isabella", "F", "42"], ["Matias", "M"]]);
});

test("Cannot create table with invalid data", async () => {
    function testDataConstructor(columns: string[], data: string[][]) {
        expect(() => new Table(columns, data)).toThrow(expect.objectContaining({type: Table.ErrorTypes.InconsistentRowLengths}));
    }
    testDataConstructor(["name", "gender", "age"], [["Pedro", "M"], ["Isabella", "F", "32"], ["Matias", "M", "94"]]);
    testDataConstructor(["name", "gender", "age"], [["Pedro", "M", "33"], ["Isabella", "F"], ["Matias", "M", "94"]]);
    testDataConstructor(["name", "gender", "age"], [["Pedro", "M", "33"], ["Isabella", "F", "32"], ["Matias", "M"]]);


    async function testFileConstructor(data: string, filename: string = "sussy-file.sus") {
        readFileMock.mockImplementationOnce((path, options, callbackFn) => callbackFn(null, data));
        let callbackFn = jest.fn((error: Table.Error | null) => {
            expect(error).toEqual(expect.objectContaining({type: Table.ErrorTypes.InconsistentRowLengths}));
        });
        new Table(filename, callbackFn);
        expect(readFileMock).toHaveBeenLastCalledWith(filename, expect.any(String), expect.any(Function));
    }
    await testFileConstructor("name,gender,age\nPedro,M\nIsabella,F,42\nMatias,M,94");
    await testFileConstructor("name,gender,age\nPedro,M,33\nIsabella,F\nMatias,M,94");
    await testFileConstructor("name,gender,age\nPedro,M,33\nIsabella,F,42\nMatias,M");
});

test("Cannot alter columns (tables with different columns are different tables)", () => {
    let columns = ["column1", "column2", "column3"];
    let table = new Table(columns, [["row1column1", "row1column2", "row1column3"], ["row2column1", "row2column2", "row2column3"]]);

    // if the test fails here its because you forgot to clone Table.#columns in the Table.columns getter (if table.#columns === columns, then you can just alter columns and table.#columns will alter too since its just one array/object shared between 2 variables)
    expect(table.columns).not.toBe(columns);

    // compile errors cannot be checked :(
    // table.columns = ["hi"];

    // no other way to alter the columns :l
});