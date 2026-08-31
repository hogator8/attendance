import "server-only";
import path from "node:path";
import fs from "node:fs";
import {
  Document,
  Page,
  View,
  Text,
  Font,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { CertificateData, SchoolSettings } from "./data";

let fontRegistered = false;
function ensureFontRegistered() {
  if (fontRegistered) return;
  const fontPath = path.join(process.cwd(), "public", "fonts", "ipag.ttf");
  const base64 = fs.readFileSync(fontPath).toString("base64");
  Font.register({ family: "IPAGothic", src: `data:font/ttf;base64,${base64}` });
  fontRegistered = true;
}

const GENDER_LABEL: Record<string, string> = {
  male: "男",
  female: "女",
  男: "男",
  女: "女",
};

function fmtHours(n: number): string {
  return n.toFixed(1);
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "IPAGothic",
    fontSize: 8,
    padding: 28,
    color: "#111827",
  },
  schoolName: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 4,
  },
  issueDate: {
    fontSize: 8,
    textAlign: "right",
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 14,
  },
  infoTable: {
    borderWidth: 1,
    borderColor: "#333333",
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
  },
  infoHeaderCell: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: "#333333",
    backgroundColor: "#f1f5f9",
    padding: 4,
    textAlign: "center",
  },
  infoValueCell: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: "#333333",
    padding: 5,
    textAlign: "center",
    minHeight: 20,
  },
  sectionTitle: {
    fontSize: 10,
    backgroundColor: "#1e293b",
    color: "#ffffff",
    padding: 3,
    marginTop: 8,
    marginBottom: 3,
  },
  monthTable: {
    borderWidth: 1,
    borderColor: "#333333",
  },
  monthRow: {
    flexDirection: "row",
  },
  monthLabelCell: {
    width: 55,
    borderWidth: 0.5,
    borderColor: "#333333",
    padding: 3,
    textAlign: "center",
    backgroundColor: "#f1f5f9",
  },
  monthDataCell: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: "#333333",
    padding: 3,
    textAlign: "center",
  },
  remarksBox: {
    borderWidth: 1,
    borderColor: "#333333",
    marginTop: 8,
    minHeight: 46,
    padding: 5,
  },
  remarksLabel: {
    fontSize: 8,
    marginBottom: 3,
  },
  footer: {
    marginTop: 16,
    alignItems: "flex-end",
  },
  footerLine: {
    fontSize: 9,
    marginBottom: 2,
    textAlign: "right",
  },
});

function InfoTable({
  cols,
}: {
  cols: { label: string; value: string; width?: number }[];
}) {
  return (
    <View style={styles.infoTable}>
      <View style={styles.infoRow}>
        {cols.map((c, i) => (
          <View key={i} style={[styles.infoHeaderCell, c.width ? { flex: c.width } : {}]}>
            <Text>{c.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.infoRow}>
        {cols.map((c, i) => (
          <View key={i} style={[styles.infoValueCell, c.width ? { flex: c.width } : {}]}>
            <Text>{c.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MonthBlock({
  year,
  cells,
}: {
  year: number;
  cells: { month: number; courseHours: number; attendanceHours: number; rate: number }[];
}) {
  return (
    <View style={styles.monthTable}>
      <View style={styles.monthRow}>
        <View style={styles.monthLabelCell}>
          <Text>{year}年</Text>
        </View>
        {cells.map((c) => (
          <View key={c.month} style={styles.monthDataCell}>
            <Text>{c.month}月</Text>
          </View>
        ))}
      </View>
      <View style={styles.monthRow}>
        <View style={styles.monthLabelCell}>
          <Text>授業時間数</Text>
        </View>
        {cells.map((c) => (
          <View key={c.month} style={styles.monthDataCell}>
            <Text>{fmtHours(c.courseHours)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.monthRow}>
        <View style={styles.monthLabelCell}>
          <Text>出席時間数</Text>
        </View>
        {cells.map((c) => (
          <View key={c.month} style={styles.monthDataCell}>
            <Text>{fmtHours(c.attendanceHours)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.monthRow}>
        <View style={styles.monthLabelCell}>
          <Text>出席率</Text>
        </View>
        {cells.map((c) => (
          <View key={c.month} style={styles.monthDataCell}>
            <Text>{c.courseHours > 0 ? fmtPct(c.rate) : "-"}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export async function renderCertificatePdf(
  data: CertificateData,
  school: SchoolSettings,
  remarks: string,
  longVacation: string,
  issueDate: string,
): Promise<Buffer> {
  ensureFontRegistered();
  const { student } = data;
  const [issueYear, issueMonth, issueDay] = issueDate.split("-");

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.schoolName}>{school.schoolName || "（学校名未設定）"}</Text>
        <Text style={styles.issueDate}>
          {issueYear}年{Number(issueMonth)}月{Number(issueDay)}日
        </Text>
        <Text style={styles.title}>出席証明書</Text>

        <InfoTable
          cols={[
            { label: "学籍番号", value: student.student_number, width: 1.2 },
            { label: "氏名", value: student.name, width: 1.6 },
            { label: "国籍", value: student.nationality ?? "", width: 1 },
            {
              label: "性別",
              value: student.gender ? GENDER_LABEL[student.gender] ?? student.gender : "",
              width: 0.8,
            },
            { label: "生年月日", value: fmtDate(student.date_of_birth), width: 1.4 },
          ]}
        />

        <InfoTable
          cols={[
            { label: "入学年月日", value: fmtDate(student.enrollment_date), width: 1.3 },
            {
              label: "卒業予定年月日",
              value: fmtDate(student.expected_graduation_date),
              width: 1.3,
            },
            { label: "累計授業時間数", value: `${fmtHours(data.cumulativeCourseHours)}時間`, width: 1.2 },
            {
              label: "累計出席時間数",
              value: `${fmtHours(data.cumulativeAttendanceHours)}時間`,
              width: 1.2,
            },
            { label: "累計出席率", value: fmtPct(data.cumulativeRate), width: 1 },
          ]}
        />

        <Text style={styles.sectionTitle}>出席状況</Text>
        <MonthBlock
          year={data.monthBlocks[0][0]?.year ?? new Date().getFullYear()}
          cells={data.monthBlocks[0]}
        />
        <View style={{ height: 6 }} />
        <MonthBlock
          year={data.monthBlocks[1][0]?.year ?? new Date().getFullYear()}
          cells={data.monthBlocks[1]}
        />

        <View style={styles.remarksBox}>
          <Text style={styles.remarksLabel}>特記事項：</Text>
          <Text>{remarks}</Text>
        </View>

        <View style={styles.remarksBox}>
          <Text style={styles.remarksLabel}>長期休暇：</Text>
          <Text>{longVacation}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLine}>{school.schoolName || "（学校名未設定）"}</Text>
          <Text style={styles.footerLine}>校長：{school.principalName}</Text>
          <Text style={styles.footerLine}>住所：{school.schoolAddress}</Text>
          <Text style={styles.footerLine}>TEL：{school.schoolPhone}</Text>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
