package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
)

type BoxStatsJson struct {
	Stats []BoxStats
}

type BoxStats struct {
	Key     string `json:"Key"`
	Samples Statistics
}

type Statistics struct {
	Average                  float64   `json:"Average"`
	Minimum                  float64   `json:"Minimum"`
	Maximum                  float64   `json:"Maximum"`
	StandardDeviation        float64   `json:"StandardDeviation"`
	NumberOfSamples          int32     `json:"NumberOfSamples"`
	Data                     []float64 `json:"Data"`
	TimestampsInMicroSeconds []int64   `json:"TimestampsInMicroSeconds"`
}

type ChartData struct {
	Datasets []ChartDataset
}

type ChartDataset struct {
	Label string    `json:"label"`
	DataX []float64 `json:"dataX"`
	DataY []float64 `json:"dataY"`
}

func (cData *ChartData) format(boxStats []BoxStats) {

	for _, stat := range boxStats {
		var cDataset ChartDataset
		cDataset.Label = stat.Key

		// convert the microseconds timestamp into seconds...
		for _, v := range stat.Samples.TimestampsInMicroSeconds {
			tsInSeconds := float64(v) * 0.000001
			cDataset.DataX = append(cDataset.DataX, tsInSeconds)
		}

		cDataset.DataY = stat.Samples.Data

		cData.Datasets = append(cData.Datasets, cDataset)
	}
}

//---------------------------------------------------------------------------------------------------------------------
func main() {
	addressAndPort := "localhost:8000"
	fmt.Printf("Starting on %s\n", addressAndPort)

	http.HandleFunc("/uploadData", uploadData)
	http.HandleFunc("/visualizeData", visualizeData)
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	log.Fatal(http.ListenAndServe(addressAndPort, nil))
}

//---------------------------------------------------------------------------------------------------------------------
func uploadData(w http.ResponseWriter, req *http.Request) {
	//fmt.Fprintf(w, "upload data\n")

	jsonContent := []byte(req.FormValue("body"))

	// read data
	var bs []BoxStats

	err := json.Unmarshal(jsonContent, &bs)

	//fmt.Fprintf(w, "bs[0].Key: %v\n", bs[0].Key)
	//fmt.Fprintf(w, "bs[0].Samples: %v\n", bs[0].Samples.Average)

	var charData ChartData
	charData.format(bs)

	//t, err := template.ParseFiles("./static/templates/ChartTemplate.gohtml")
	t, err := template.ParseFiles("./static/templates/ChartCartesian.html")
	checkError(err)

	t.Execute(w, charData)

	checkError(err)
}

//---------------------------------------------------------------------------------------------------------------------
func visualizeData(w http.ResponseWriter, req *http.Request) {
	fmt.Fprintf(w, "visualize data")
}

//---------------------------------------------------------------------------------------------------------------------
func checkError(err error) {
	if err != nil {
		fmt.Print(err)
		panic(err)
	}
}
