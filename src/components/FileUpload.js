import React, { useState } from "react";
import axios from "axios";
import { Button, Box, Typography, LinearProgress } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

const FileUpload = ({ onResult }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Lütfen bir dosya seçin!");
      return;
    }
    setUploading(true);

    const formData = new FormData();
    formData.append("audio", file);

    try {
      const res = await axios.post("http://localhost:5000/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onResult(res.data);
    } catch (err) {
      alert("Yükleme sırasında hata oluştu.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
      <Typography variant="h6" mb={2}>
        Ses Dosyası Yükle
      </Typography>
      <Button
        variant="outlined"
        component="label"
        startIcon={<CloudUploadIcon />}
        sx={{ mb: 2 }}
      >
        Dosya Seç
        <input type="file" accept="audio/*" hidden onChange={handleFileChange} />
      </Button>
      {file && (
        <Typography variant="body2" color="text.secondary" mb={1}>
          {file.name}
        </Typography>
      )}
      <Button
        variant="contained"
        color="primary"
        onClick={handleUpload}
        disabled={uploading}
        sx={{ minWidth: 120 }}
      >
        {uploading ? "Yükleniyor..." : "Yükle"}
      </Button>
      {uploading && <LinearProgress sx={{ width: "100%", mt: 2 }} />}
    </Box>
  );
};

export default FileUpload;
