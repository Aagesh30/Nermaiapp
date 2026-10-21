const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../web_portal/App.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const isCRLF = content.includes('\r\n');
let text = content.replace(/\r\n/g, '\n');

// 1. Fix line 35831: remove extra ')'
const badLine35831 = `                                          </View>
                                        </View>
                                        )
                                      )}`;
const goodLine35831 = `                                          </View>
                                        </View>
                                      )}`;
if (!text.includes(badLine35831)) {
    console.error("badLine35831 not found!");
    process.exit(1);
}
text = text.replace(badLine35831, goodLine35831);

// 2. Fix line 39414: close ternary for hallticket customizer
const badHallTicketEnd = `                                              {renderHallTicket(sampleStudentForPreview, hallTicketExamName, hallTicketExamDate, hallTicketVenue, hallTicketTime, hallTicketInstructions)}
                                            </View>
                                          </View>
                                        </View>
                                      )}`;
const goodHallTicketEnd = `                                              {renderHallTicket(sampleStudentForPreview, hallTicketExamName, hallTicketExamDate, hallTicketVenue, hallTicketTime, hallTicketInstructions)}
                                            </View>
                                          </View>
                                        </View>
                                        )
                                      )}`;

if (!text.includes(badHallTicketEnd)) {
    console.error("badHallTicketEnd not found!");
    process.exit(1);
}
text = text.replace(badHallTicketEnd, goodHallTicketEnd);

const output = isCRLF ? text.replace(/\n/g, '\r\n') : text;
fs.writeFileSync(filePath, output, 'utf8');
console.log("✅ Fixed JSX syntax in App.tsx!");
