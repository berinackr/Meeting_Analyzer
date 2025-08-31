import React, { useState } from "react";
import FileUpload from "./components/FileUpload";
import ResultView from "./components/ResultView";
import { Container, Typography, Paper, Box, Button } from "@mui/material";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";

function App() {
  const [result, setResult] = useState(null);

  // Sonuç ekranından tekrar yükleme yapmak için sıfırlama
  const handleReset = () => setResult(null);

  return (
    <Box sx={{ minHeight: "100vh", background: "#f5f6fa" }}>
      {!result ? (
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#f5f6fa",
          }}
        >
          <Paper elevation={4} sx={{ p: { xs: 3, sm: 6 }, borderRadius: 4, minWidth: 340 }}>
            <Box display="flex" alignItems="center" justifyContent="center" mb={3}>
              <GraphicEqIcon color="primary" sx={{ fontSize: 56, mr: 2 }} />
              <Typography variant="h3" fontWeight={700}>
                Meeting Analyzer
              </Typography>
            </Box>
            <FileUpload onResult={setResult} />
          </Paper>
        </Box>
      ) : (
        <Container maxWidth="lg" sx={{ py: 6 }}>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button variant="outlined" color="primary" onClick={handleReset}>
              Yeni Ses Yükle
            </Button>
          </Box>
          <ResultView result={result} />
        </Container>
      )}
    </Box>
  );
}

export default App;
