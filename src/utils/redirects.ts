export const parseRedirectsFile = async (content: string) => {
  const rules = [];
  try {
    const lines = content.split("\n");

    for (const line of lines) {
      try {
        if (line.trim().startsWith("#") || line.trim() === "") continue;
  
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) continue;
    
        const rule = {
          source: parts[0],
          destination: parts[1],
          status: parts.length > 2 ? parseInt(parts[2], 10) : 301,
          force: parts.includes("!"),
          // proxy: parts.includes("200"),
        };
    
        rules.push(rule); 
      } catch (error) {
        console.log(error);
      }    
    } 
  } catch (error) {
    console.log(error);    
  }  

  return rules;
}
