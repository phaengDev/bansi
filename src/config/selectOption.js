import React,{useState,useEffect} from "react";
import { Config } from "./connection";
const api=Config.API;

export function useProvince() {
    const [itemProvince, setItemProvince] = useState([]);
    useEffect(() => {
      const showProvince = async () => {
        try {
          const response = await fetch(api + 'province');
          const jsonData = await response.json();
          setItemProvince(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showProvince();
    }, []);
    const data = itemProvince.map(item => ({ label: item.province_name, value: item.province_id }));
    return data;
  }

  export function useDistrict(id) {
    const [itemDistrict, setItemDistrict] = useState([]);
    useEffect(() => {
      const showDistrict = async () => {
        try {
          const response = await fetch(api + 'district/pv/'+id);
          const jsonData = await response.json();
          setItemDistrict(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showDistrict();
    }, [id]);
    const data = itemDistrict.map(item => ({ label: item.district_name, value: item.district_id }));
    return data;
  }



export function useDepart() {
    const [itemDepart, setItemDepart] = useState([]);
    useEffect(() => {
      const showDepart = async () => {
        try {
          const response = await fetch(api + 'depart');
          const jsonData = await response.json();
          setItemDepart(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showDepart();
    }, []);
    const data = itemDepart.map(item => ({ label: item.depart_name, value: item.department_id }));
    return data;
  }

  export function useRights() {
    const [itemRights, setItemRights] = useState([]);
    useEffect(() => {
      const showRights = async () => {
        try {
          const response = await fetch(api + 'rights');
          const jsonData = await response.json();
          setItemRights(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showRights();
    }, []);
    const data = itemRights.map(item => ({ label: item.rightsName, value: item.rightsId }));
    return data;
  }
  


  export function useType() {
    const [itemType, setItemType] = useState([]);
    useEffect(() => {
      const showType = async () => {
        try {
          const response = await fetch(api + 'type/group');
          const jsonData = await response.json();
          setItemType(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showType();
    }, []);
    const data = itemType.map(item => ({ label: '( '+item.type_code+' ) '+item.type_name, value: item.type_id,codes:item.type_code }));
    return data;
  }



export function usePage(data) {

    const limit = [{
      label: 25, value: 25
    },
    {
      label: 50, value: 50
    },
    {
      label: 100, value: 100
    },
    {
      label: 150, value: 150
    },
    {
      label: 200, value: 200
    },
    {
      label: '--ທັງໝົດ--', value: data
    },];
  
    return limit;
  }