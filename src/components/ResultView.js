import React, { useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Stack,
  Divider,
  Button,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PieChartIcon from "@mui/icons-material/PieChart";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Daha yumuşak ve modern renk paleti
const speakerColors = [
  "#90caf9", // açık mavi
  "#ffab91", // açık turuncu
  "#a5d6a7", // açık yeşil
  "#ffe082", // açık sarı
  "#ce93d8", // açık mor
  "#80cbc4", // açık camgöbeği
  "#ffcc80", // açık turuncu-bej
  "#b0bec5", // açık gri
];

// Her konuşmacıya bir renk eşle
function getSpeakerColor(speakerId, speakers) {
  const idx = speakers.findIndex((spk) => spk.id === speakerId);
  return speakerColors[idx % speakerColors.length];
}

const ResultView = ({ result }) => {
  const [includeChat, setIncludeChat] = useState(false);

  if (!result) return null;

  // Tüm konuşmacıların transcriptlerini zaman sırasına göre birleştir
  let allSegments = [];
  result.speakers.forEach((spk) => {
    if (spk.transcripts && Array.isArray(spk.transcripts)) {
      spk.transcripts.forEach((line) => {
        const match = line.match(/^([\d.]+)-([\d.]+):\s*(.*)$/);
        if (match) {
          allSegments.push({
            speaker: spk.id,
            gender: spk.gender,
            start: parseFloat(match[1]),
            end: parseFloat(match[2]),
            text: match[3],
          });
        }
      });
    }
  });
  allSegments.sort((a, b) => a.start - b.start);

  // PDF oluşturma fonksiyonu
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("TOPLANTI ANALIZ RAPORU", 14, 18);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`TOPLAM SURE: ${result.duration_seconds}s`, 14, 30);
    doc.text(`KONUSMA: ${result.speech_seconds}s`, 14, 38);
    doc.text(`SESSIZLIK: ${result.silence_seconds}s`, 14, 46);
    doc.text(`KONUSMACI SAYISI: ${result.num_speakers}`, 14, 54);

    autoTable(doc, {
      startY: 60,
      head: [["KONUSMACI", "KONUSMA SURESI (s)", "CINSIYET"]],
      body: result.speakers.map((spk) => [
        spk.id,
        spk.duration,
        spk.gender === "male" ? "ERKEK" : "KADIN",
      ]),
      theme: "grid",
      headStyles: { fillColor: [144, 202, 249] },
      styles: { fontSize: 10 },
    });

    let y = doc.lastAutoTable.finalY + 8;

    doc.text(
      `CINSIYET DAGILIMI (KONUSMA SURESI): ERKEK %${result.gender_distribution.male} / KADIN %${result.gender_distribution.female}`,
      14,
      y
    );
    y += 8;
    doc.text(
      `KATILIMCI DAGILIMI (KISI SAYISI): ERKEK %${result.participant_distribution.male} / KADIN %${result.participant_distribution.female}`,
      14,
      y
    );

    if (includeChat) {
      y += 12;
      doc.setFontSize(14);
      doc.text("SOHBET AKISI", 14, y);
      doc.setFontSize(11);
      y += 6;
      allSegments.forEach((seg) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFont("helvetica", "bold");
        doc.text(`${seg.speaker}:`, 7, y);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(seg.text, 160);
        doc.text(lines, 34, y);
        y += 7 * lines.length;
      });
    }

    doc.save("toplanti-analiz.pdf");
  };

  return (
    <Box mt={4}>
      <Paper
        elevation={2}
        sx={{
          p: 3,
          borderRadius: 4,
          background: "#f7fafd",
          boxShadow: "0 2px 16px 0 rgba(80,120,200,0.06)",
        }}
      >
        <Box display="flex" justifyContent="flex-end" mb={2} gap={2}>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeChat}
                onChange={(e) => setIncludeChat(e.target.checked)}
                color="primary"
              />
            }
            label="Sohbet Akışını PDF'e Ekle"
          />
          <Button variant="contained" color="primary" onClick={handleDownloadPDF}>
            PDF Olarak İndir
          </Button>
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 4,
            alignItems: "flex-start",
          }}
        >
          {/* Sol: Analiz Sonuçları */}
          <Box flex={1} minWidth={280}>
            <Typography variant="h5" fontWeight={600} mb={2} color="#3b4252">
              <PieChartIcon sx={{ mr: 1, verticalAlign: "middle", color: "#64b5f6" }} />
              Analiz Sonucu
            </Typography>
            <Stack direction="row" spacing={2} mb={2}>
              <Chip
                label={`Toplam Süre: ${result.duration_seconds}s`}
                sx={{ background: "#e3f2fd", color: "#1976d2", fontWeight: 500 }}
              />
              <Chip
                label={`Konuşma: ${result.speech_seconds}s`}
                sx={{ background: "#e8f5e9", color: "#388e3c", fontWeight: 500 }}
              />
              <Chip
                label={`Sessizlik: ${result.silence_seconds}s`}
                sx={{ background: "#fff8e1", color: "#fbc02d", fontWeight: 500 }}
              />
            </Stack>
            <Typography variant="h6" mt={2} mb={1} color="#3b4252">
              <PeopleAltIcon sx={{ mr: 1, verticalAlign: "middle", color: "#ba68c8" }} />
              Konuşmacılar ({result.num_speakers})
            </Typography>
            <TableContainer
              component={Paper}
              sx={{
                mb: 2,
                background: "#f3f6f9",
                borderRadius: 2,
                boxShadow: "none",
                border: "1px solid #e0e3e7",
              }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: "#607d8b", fontWeight: 600 }}>ID</TableCell>
                    <TableCell sx={{ color: "#607d8b", fontWeight: 600 }}>Konuşma Süresi (s)</TableCell>
                    <TableCell sx={{ color: "#607d8b", fontWeight: 600 }}>Cinsiyet</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.speakers.map((spk) => (
                    <TableRow key={spk.id}>
                      <TableCell>{spk.id}</TableCell>
                      <TableCell>{spk.duration}</TableCell>
                      <TableCell>
                        <Chip
                          label={spk.gender === "male" ? "Erkek" : "Kadın"}
                          sx={{
                            background: spk.gender === "male" ? "#bbdefb" : "#f8bbd0",
                            color: spk.gender === "male" ? "#1976d2" : "#ad1457",
                            fontWeight: 500,
                          }}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="h6" mt={2} color="#3b4252">
              Cinsiyet Dağılımı (Konuşma Süresi)
            </Typography>
            <Stack direction="row" spacing={2} mt={1} mb={2}>
              <Chip
                label={`Erkek: %${result.gender_distribution.male}`}
                sx={{ background: "#e3f2fd", color: "#1976d2", fontWeight: 500 }}
              />
              <Chip
                label={`Kadın: %${result.gender_distribution.female}`}
                sx={{ background: "#fce4ec", color: "#ad1457", fontWeight: 500 }}
              />
            </Stack>
            <Typography variant="h6" mt={2} color="#3b4252">
              Katılımcı Dağılımı (Kişi Sayısı)
            </Typography>
            <Stack direction="row" spacing={2} mt={1}>
              <Chip
                label={`Erkek: %${result.participant_distribution.male}`}
                sx={{
                  background: "#e3f2fd",
                  color: "#1976d2",
                  fontWeight: 500,
                  border: "1px solid #90caf9",
                }}
                variant="outlined"
              />
              <Chip
                label={`Kadın: %${result.participant_distribution.female}`}
                sx={{
                  background: "#fce4ec",
                  color: "#ad1457",
                  fontWeight: 500,
                  border: "1px solid #f8bbd0",
                }}
                variant="outlined"
              />
            </Stack>
          </Box>
          {/* Orta çizgi (sadece md ve üstü ekranlarda) */}
          <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" }, mx: 1, borderColor: "#e0e3e7" }} />
          {/* Sağ: Sohbet Akışı */}
          <Box flex={1.2} minWidth={320}>
            <Typography variant="h6" mb={1} color="#3b4252">
              Sohbet Akışı
            </Typography>
            <Box
              sx={{
                maxHeight: 500,
                overflow: "auto",
                background: "#f3f6f9",
                p: 2,
                borderRadius: 2,
                border: "1px solid #e0e3e7",
              }}
            >
              {allSegments.length === 0 ? (
                <Typography color="text.secondary" fontStyle="italic">
                  Transcript bulunamadı.
                </Typography>
              ) : (
                allSegments.map((seg, idx) => {
                  const color = getSpeakerColor(seg.speaker, result.speakers);
                  return (
                    <Box
                      key={idx}
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        mb: 1.5,
                        pl: 0,
                        pr: 0,
                        flexDirection: "row",
                      }}
                    >
                      <Chip
                        label={seg.speaker}
                        sx={{
                          mr: 1,
                          ml: 1,
                          background: color,
                          color: "#374151",
                          fontWeight: 700,
                          fontSize: 15,
                          letterSpacing: 0.5,
                        }}
                        size="small"
                      />
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.2,
                          background: "#fff",
                          borderLeft: `6px solid ${color}`,
                          minWidth: 0,
                          maxWidth: "80%",
                          boxShadow: "0 1px 6px 0 rgba(80,120,200,0.04)",
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: "pre-line", color: "#374151" }}>
                          {seg.text}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          [{seg.start.toFixed(2)} - {seg.end.toFixed(2)} sn]
                        </Typography>
                      </Paper>
                    </Box>
                  );
                })
              )}
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default ResultView;
